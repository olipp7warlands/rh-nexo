import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Gestión de usuarios: alta con contraseña temporal (una sola vez), cambio forzado en el primer uso,
 * cambio voluntario, rol, desactivar/reactivar, restablecer contraseña, protecciones y auditoría.
 * Trabaja SOLO con cuentas propias (marcador único): jamás desactiva ni cambia las del seed, que
 * usan otros specs en paralelo. Requiere Postgres de TEST migrado y sembrado.
 */
describe('Gestión de usuarios (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let adminToken: string;
  let adminUserId: string;
  const tag = `usr${Date.now()}`;
  const employeeIds: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string, password: string) => request(http).post('/api/auth/login').send({ email, password });
  const loginToken = (email: string, password: string) => login(email, password).then((r) => r.body.accessToken as string);
  const NEW_PASSWORD = 'Contraseña-segura-2026!';

  let seq = 0;
  const mkEmployee = async (extra: Record<string, unknown> = {}) => {
    const tipo = await db.tipoContrato.findFirstOrThrow();
    const e = await db.employee.create({
      data: {
        fullName: `${tag} Persona ${++seq}`,
        email: `${tag}.${seq}@example.com`,
        jobTitle: 'Analista',
        level: 'mid',
        startDate: new Date('2026-01-01'),
        localizacionId: 'loc-madrid',
        tipoContratoId: tipo.id,
        ...extra,
      },
    });
    employeeIds.push(e.id);
    return e;
  };
  const giveAccess = (employeeId: string, role: string, token = adminToken) =>
    request(http).post('/api/users').set(auth(token)).send({ employeeId, role });

  /** Crea persona + cuenta y la deja lista para usar (contraseña ya cambiada). */
  const readyUser = async (role: string) => {
    const emp = await mkEmployee();
    const res = await giveAccess(emp.id, role).expect(201);
    const temp = res.body.temporaryPassword as string;
    const first = await login(emp.email, temp).expect(200);
    const changed = await request(http)
      .post('/api/auth/change-password')
      .set(auth(first.body.accessToken))
      .send({ currentPassword: temp, newPassword: NEW_PASSWORD })
      .expect(200);
    return { emp, userId: res.body.user.id as string, token: changed.body.accessToken as string, refresh: changed.body.refreshToken as string };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    adminToken = await loginToken('admin@grupo.com', 'nucleo123');
    adminUserId = (await db.user.findUniqueOrThrow({ where: { email: 'admin@grupo.com' } })).id;
  });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    await db.refreshToken.deleteMany({ where: { userId: { in: ids } } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { actorId: { in: ids } }] } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await db.employee.deleteMany({ where: { id: { in: employeeIds } } }).catch(() => undefined);
    await app.close();
  });

  describe('permisos', () => {
    it.each([
      ['blanca.ruiz@grupo.com', 'RRHH'],
      ['carlos.soto@grupo.com', 'MANAGER'],
      ['diego.ortega@grupo.com', 'EMPLEADO'],
    ])('%s (%s) no puede gestionar cuentas (403 en todo)', async (email) => {
      const t = await loginToken(email, 'nucleo123');
      await request(http).get('/api/users').set(auth(t)).expect(403);
      await request(http).post('/api/users').set(auth(t)).send({ employeeId: 'e1', role: 'EMPLEADO' }).expect(403);
      await request(http).patch('/api/users/x').set(auth(t)).send({ role: 'ADMIN' }).expect(403);
      await request(http).post('/api/users/x/deactivate').set(auth(t)).expect(403);
      await request(http).post('/api/users/x/reactivate').set(auth(t)).expect(403);
      await request(http).post('/api/users/x/reset-password').set(auth(t)).expect(403);
    });

    it('no existe DELETE de cuentas', async () => {
      await request(http).delete('/api/users/x').set(auth(adminToken)).expect(404);
    });
  });

  describe('alta con contraseña temporal', () => {
    it('crea la cuenta, la temporal se devuelve una vez (no-store) y no se filtra ni se audita', async () => {
      const emp = await mkEmployee();
      const res = await giveAccess(emp.id, 'MANAGER').expect(201);
      expect(res.headers['cache-control']).toContain('no-store');
      const temp = res.body.temporaryPassword as string;
      expect(temp).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
      expect(res.body.user).toMatchObject({ email: emp.email, role: 'MANAGER', isActive: true, mustChangePassword: true, employeeId: emp.id });

      // Nunca se vuelve a mostrar: ni el listado ni nada la devuelven.
      const list = await request(http).get(`/api/users?employeeId=${emp.id}`).set(auth(adminToken)).expect(200);
      expect(list.body).toHaveLength(1);
      expect(JSON.stringify(list.body)).not.toMatch(/passwordHash|temporaryPassword/);
      expect(JSON.stringify(list.body)).not.toContain(temp);

      // En BD no está en claro, y la auditoría no contiene contraseñas ni hashes.
      const stored = await db.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
      expect(stored.passwordHash).not.toContain(temp);
      const logs = await db.auditLog.findMany({ where: { entity: 'User', entityId: res.body.user.id } });
      expect(logs.map((l) => l.action)).toEqual(['CREATE']);
      const blob = JSON.stringify(logs);
      expect(blob).not.toContain(temp);
      expect(blob).not.toContain(stored.passwordHash);
      expect(blob.toLowerCase()).not.toContain('passwordhash');
      expect(logs[0]!.actorId).toBe(adminUserId);
    });

    it('rechaza segunda cuenta para la misma persona (409), email ya usado (409), persona de baja (400) y datos inválidos', async () => {
      const emp = await mkEmployee();
      await giveAccess(emp.id, 'EMPLEADO').expect(201);
      await giveAccess(emp.id, 'EMPLEADO').expect(409);

      const other = await mkEmployee();
      await db.user.create({ data: { email: other.email.toUpperCase(), passwordHash: 'x', role: 'EMPLEADO' } });
      await giveAccess(other.id, 'EMPLEADO').expect(409);
      await db.user.deleteMany({ where: { email: other.email.toUpperCase() } });

      const baja = await mkEmployee({ status: 'BAJA' });
      await giveAccess(baja.id, 'EMPLEADO').expect(400);
      await giveAccess('no-existe', 'EMPLEADO').expect(404);
      await giveAccess(emp.id, 'SUPERUSER').expect(400);
    });
  });

  describe('primer uso: cambio forzado', () => {
    it('con la temporal solo se puede ver /auth/me y cambiar la contraseña; el resto da 403 PASSWORD_CHANGE_REQUIRED', async () => {
      const emp = await mkEmployee();
      const created = await giveAccess(emp.id, 'EMPLEADO').expect(201);
      const temp = created.body.temporaryPassword as string;
      const l = await login(emp.email, temp).expect(200);
      expect(l.body.user.mustChangePassword).toBe(true);
      const t = l.body.accessToken as string;

      const blocked = await request(http).get('/api/employees').set(auth(t)).expect(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      const me = await request(http).get('/api/auth/me').set(auth(t)).expect(200);
      expect(me.body.mustChangePassword).toBe(true);

      // Después de cambiarla se desbloquea.
      const changed = await request(http)
        .post('/api/auth/change-password')
        .set(auth(t))
        .send({ currentPassword: temp, newPassword: NEW_PASSWORD })
        .expect(200);
      expect(changed.body.user.mustChangePassword).toBe(false);
      await request(http).get('/api/employees').set(auth(changed.body.accessToken)).expect(200);
    });

    it('las cuentas del seed no están marcadas para cambio', async () => {
      const l = await login('admin@grupo.com', 'nucleo123').expect(200);
      expect(l.body.user.mustChangePassword).toBe(false);
    });
  });

  describe('cambio de contraseña propio', () => {
    it('valida actual, longitud, distinta, no-email y 72 bytes; uno válido revoca sesiones y tokens anteriores', async () => {
      const u = await readyUser('EMPLEADO');
      const send = (body: Record<string, string>) =>
        request(http).post('/api/auth/change-password').set(auth(u.token)).send(body);

      await send({ currentPassword: 'incorrecta-1234', newPassword: 'Otra-contraseña-larga-1' }).expect(400);
      await send({ currentPassword: NEW_PASSWORD, newPassword: 'corta' }).expect(400);
      await send({ currentPassword: NEW_PASSWORD, newPassword: NEW_PASSWORD }).expect(400);
      await send({ currentPassword: NEW_PASSWORD, newPassword: u.emp.email }).expect(400);
      await send({ currentPassword: NEW_PASSWORD, newPassword: 'á'.repeat(37) }).expect(400); // 74 bytes
      await send({ currentPassword: NEW_PASSWORD }).expect(400);

      const ok = await send({ currentPassword: NEW_PASSWORD, newPassword: 'Tercera-contraseña-2026' }).expect(200);

      // El access token y el refresh anteriores ya no valen; el par nuevo, sí.
      await request(http).get('/api/employees').set(auth(u.token)).expect(401);
      await request(http).post('/api/auth/refresh').send({ refreshToken: u.refresh }).expect(401);
      await request(http).get('/api/employees').set(auth(ok.body.accessToken)).expect(200);

      await login(u.emp.email, NEW_PASSWORD).expect(401);
      await login(u.emp.email, 'Tercera-contraseña-2026').expect(200);

      const logs = await db.auditLog.findMany({ where: { entity: 'User', entityId: u.userId, action: 'PASSWORD_CHANGE' } });
      expect(logs.length).toBeGreaterThanOrEqual(2); // el del alta del helper + este
      expect(logs.every((l) => l.actorId === u.userId)).toBe(true);
      const blob = JSON.stringify(logs);
      expect(blob).not.toContain('Tercera-contraseña-2026');
      expect(blob.toLowerCase()).not.toContain('passwordhash');
    });
  });

  describe('rol', () => {
    it('cambia el rol (efecto inmediato), audita antes/después y no admite roles inválidos', async () => {
      const u = await readyUser('EMPLEADO');
      const res = await request(http).patch(`/api/users/${u.userId}`).set(auth(adminToken)).send({ role: 'RRHH' }).expect(200);
      expect(res.body.role).toBe('RRHH');
      const me = await request(http).get('/api/auth/me').set(auth(u.token)).expect(200);
      expect(me.body.role).toBe('RRHH');
      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'User', entityId: u.userId, action: 'UPDATE' } });
      expect(log.before).toEqual({ role: 'EMPLEADO' });
      expect(log.after).toEqual({ role: 'RRHH' });
      await request(http).patch(`/api/users/${u.userId}`).set(auth(adminToken)).send({ role: 'DIOS' }).expect(400);
      await request(http).patch('/api/users/no-existe').set(auth(adminToken)).send({ role: 'RRHH' }).expect(404);
    });
  });

  describe('desactivar / reactivar', () => {
    it('desactivar corta sesiones y acceso, reactivar los devuelve; ambos auditados; nunca borra', async () => {
      const u = await readyUser('EMPLEADO');
      const res = await request(http).post(`/api/users/${u.userId}/deactivate`).set(auth(adminToken)).expect(200);
      expect(res.body.isActive).toBe(false);

      await request(http).get('/api/auth/me').set(auth(u.token)).expect(401);
      await request(http).post('/api/auth/refresh').send({ refreshToken: u.refresh }).expect(401);
      await login(u.emp.email, NEW_PASSWORD).expect(401);
      await request(http).post(`/api/users/${u.userId}/deactivate`).set(auth(adminToken)).expect(409);

      const deact = await db.auditLog.findFirstOrThrow({ where: { entity: 'User', entityId: u.userId, action: 'DEACTIVATE' } });
      expect((deact.after as { sessionsRevoked: number }).sessionsRevoked).toBeGreaterThanOrEqual(1);
      expect(await db.refreshToken.count({ where: { userId: u.userId, revokedAt: null } })).toBe(0);

      const re = await request(http).post(`/api/users/${u.userId}/reactivate`).set(auth(adminToken)).expect(200);
      expect(re.body.isActive).toBe(true);
      await login(u.emp.email, NEW_PASSWORD).expect(200);
      await request(http).post(`/api/users/${u.userId}/reactivate`).set(auth(adminToken)).expect(409);
      expect(await db.auditLog.count({ where: { entity: 'User', entityId: u.userId, action: 'REACTIVATE' } })).toBe(1);
      expect(await db.user.findUnique({ where: { id: u.userId } })).not.toBeNull();
    });
  });

  describe('restablecer contraseña', () => {
    it('genera otra temporal (una vez), obliga a cambiarla, revoca sesiones y audita sin secretos', async () => {
      const u = await readyUser('EMPLEADO');
      const res = await request(http).post(`/api/users/${u.userId}/reset-password`).set(auth(adminToken)).expect(200);
      expect(res.headers['cache-control']).toContain('no-store');
      const temp = res.body.temporaryPassword as string;
      expect(temp).toHaveLength(16);
      expect(res.body.user.mustChangePassword).toBe(true);

      await login(u.emp.email, NEW_PASSWORD).expect(401);
      await request(http).post('/api/auth/refresh').send({ refreshToken: u.refresh }).expect(401);
      await request(http).get('/api/auth/me').set(auth(u.token)).expect(401);
      const again = await login(u.emp.email, temp).expect(200);
      expect(again.body.user.mustChangePassword).toBe(true);
      await request(http).get('/api/employees').set(auth(again.body.accessToken)).expect(403);

      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'User', entityId: u.userId, action: 'PASSWORD_RESET' } });
      expect(log.actorId).toBe(adminUserId);
      expect(JSON.stringify(log)).not.toContain(temp);
    });

    it('un ADMIN puede restablecer a otro ADMIN (auditado)', async () => {
      const other = await readyUser('ADMIN');
      await request(http).post(`/api/users/${other.userId}/reset-password`).set(auth(adminToken)).expect(200);
      expect(await db.auditLog.count({ where: { entity: 'User', entityId: other.userId, action: 'PASSWORD_RESET' } })).toBe(1);
    });
  });

  describe('protecciones', () => {
    it('un ADMIN no puede desactivarse, cambiarse el rol ni restablecerse a sí mismo (409) y su cuenta no cambia', async () => {
      await request(http).post(`/api/users/${adminUserId}/deactivate`).set(auth(adminToken)).expect(409);
      await request(http).patch(`/api/users/${adminUserId}`).set(auth(adminToken)).send({ role: 'EMPLEADO' }).expect(409);
      await request(http).patch(`/api/users/${adminUserId}`).set(auth(adminToken)).send({ role: 'ADMIN' }).expect(409);
      await request(http).post(`/api/users/${adminUserId}/reset-password`).set(auth(adminToken)).expect(409);
      const me = await db.user.findUniqueOrThrow({ where: { id: adminUserId } });
      expect(me).toMatchObject({ isActive: true, role: 'ADMIN', mustChangePassword: false });
    });

    it('otro ADMIN sí puede desactivar o bajar de rol a un ADMIN mientras quede alguno activo', async () => {
      const a = await readyUser('ADMIN');
      const b = await readyUser('ADMIN');
      await request(http).post(`/api/users/${b.userId}/deactivate`).set(auth(a.token)).expect(200);
      await request(http).post(`/api/users/${b.userId}/reactivate`).set(auth(a.token)).expect(200);
      await request(http).patch(`/api/users/${b.userId}`).set(auth(a.token)).send({ role: 'RRHH' }).expect(200);
    });
  });
});
