import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Camino feliz de la Fase 0: autenticación JWT + RBAC + regla salario/IBAN.
 * Arranca la app Nest en memoria (sin escuchar puerto) contra la BD sembrada.
 * Requiere Postgres arriba con el seed cargado (pnpm db:seed).
 */
describe('Auth + RBAC (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;

  const login = (email: string, password: string) =>
    request(http).post('/api/auth/login').send({ email, password });

  // Usuario descartable para los tests de M6 que necesitan tocar isActive/role sin afectar
  // a las cuentas del seed (usadas por el resto de la suite en paralelo... bueno, en serie,
  // ver tasks/lessons.md #15, pero aun así es su propia cuenta, no una compartida).
  async function createTestUser(overrides: { role?: 'ADMIN' | 'EMPLEADO'; isActive?: boolean } = {}) {
    const passwordHash = await bcrypt.hash('temporal123', 10);
    return db.user.create({
      data: {
        email: `auth-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        passwordHash,
        role: overrides.role ?? 'EMPLEADO',
        isActive: overrides.isActive ?? true,
      },
    });
  }

  async function deleteTestUser(userId: string) {
    await db.refreshToken.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración que main.ts (prefijo + validación global).
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza el acceso sin token (401)', async () => {
    await request(http).get('/api/employees').expect(401);
  });

  it('login con contraseña incorrecta (401)', async () => {
    await login('admin@grupo.com', 'incorrecta').expect(401);
  });

  it('auditoría (hallazgo bajo): una contraseña de más de 72 caracteres se rechaza (400), no se hashea igual', async () => {
    await login('admin@grupo.com', 'x'.repeat(73)).expect(400);
  });

  it('camino feliz: login ADMIN → /me → lista de empleados con salario visible', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.role).toBe('ADMIN');

    const token = res.body.accessToken;
    const me = await request(http).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.email).toBe('admin@grupo.com');

    const emps = await request(http).get('/api/employees').set('Authorization', `Bearer ${token}`).expect(200);
    expect(emps.body.length).toBeGreaterThan(0);
    expect(emps.body.some((e: { salary: number | null }) => e.salary !== null)).toBe(true);
  });

  it('EMPLEADO: salario ajeno enmascarado, propio visible; no puede crear (403)', async () => {
    const res = await login('diego.ortega@grupo.com', 'nucleo123').expect(200);
    const token = res.body.accessToken;
    const ownId = res.body.user.employeeId;

    const emps = await request(http).get('/api/employees').set('Authorization', `Bearer ${token}`).expect(200);
    const others = emps.body.filter((e: { id: string }) => e.id !== ownId);
    const own = emps.body.find((e: { id: string }) => e.id === ownId);
    expect(others.every((e: { salary: number | null }) => e.salary === null)).toBe(true);
    expect(own.salary).not.toBeNull();

    await request(http)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'No Autorizado', email: 'no@x.com', jobTitle: 'x', level: 'x', location: 'x', startDate: '2026-01-01' })
      .expect(403);
  });

  it('refresh token emite un access válido', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    const refreshed = await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken: res.body.refreshToken })
      .expect(200);
    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(200);
  });

  // ── Auditoría M6: estado de la cuenta + revalidación de rol contra la BD ──

  it('M6: una cuenta con isActive=false no puede iniciar sesión', async () => {
    const user = await createTestUser({ isActive: false });
    await login(user.email, 'temporal123').expect(401);
    await deleteTestUser(user.id);
  });

  it('M6: desactivar la cuenta a mitad de sesión invalida el access token ya emitido (no espera a que caduque)', async () => {
    const user = await createTestUser({ isActive: true });
    const res = await login(user.email, 'temporal123').expect(200);
    const token = res.body.accessToken;

    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });
    // Mismo token, sin refrescar: si validate() solo mirara el payload firmado, esto pasaría.
    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);

    await deleteTestUser(user.id);
  });

  it('M6: validate() revalida el rol contra la BD, no el claim firmado del token (RolesGuard)', async () => {
    const user = await createTestUser({ role: 'EMPLEADO', isActive: true });
    const res = await login(user.email, 'temporal123').expect(200);
    const token = res.body.accessToken; // firma "role": "EMPLEADO"
    const newEmp = { fullName: 'Test M6', email: `m6-${Date.now()}@x.com`, jobTitle: 'x', level: 'x', location: 'x', startDate: '2026-01-01' };

    await request(http).post('/api/employees').set('Authorization', `Bearer ${token}`).send(newEmp).expect(403);

    await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    // Mismo access token de antes (el payload sigue diciendo EMPLEADO) — RolesGuard debe dejar
    // pasar porque JwtStrategy.validate() ha vuelto a consultar el rol en BD, no el del token.
    const created = await request(http).post('/api/employees').set('Authorization', `Bearer ${token}`).send(newEmp).expect(201);

    await db.employee.delete({ where: { id: created.body.id } });
    await deleteTestUser(user.id);
  });

  // ── Auditoría A3: refresh tokens persistidos, con rotación y detección de reutilización ──

  it('A3: el refresh token se persiste hasheado en BD (nunca en claro)', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    const row = await db.refreshToken.findFirst({
      where: { user: { email: 'admin@grupo.com' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(row).toBeTruthy();
    expect(row!.tokenHash).not.toBe(res.body.refreshToken);
    expect(row!.tokenHash).toHaveLength(64); // sha256 en hex
  });

  it('A3: refresh rota el token — el nuevo refreshToken es distinto del usado', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    const refreshed = await request(http).post('/api/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(200);
    expect(refreshed.body.refreshToken).not.toBe(res.body.refreshToken);
  });

  it('A3: reutilizar un refresh token ya rotado invalida toda la familia (también el más nuevo)', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    const first = res.body.refreshToken;
    const rotated = await request(http).post('/api/auth/refresh').send({ refreshToken: first }).expect(200);
    const second = rotated.body.refreshToken;

    // Reutilizar el primero (ya usado/rotado) → posible robo → 401 y revoca la familia entera.
    await request(http).post('/api/auth/refresh').send({ refreshToken: first }).expect(401);
    // El segundo, el "bueno" y nunca comprometido, también queda revocado por la detección.
    await request(http).post('/api/auth/refresh').send({ refreshToken: second }).expect(401);
  });

  it('A3: logout revoca la familia — el refresh token deja de servir después', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    await request(http).post('/api/auth/logout').send({ refreshToken: res.body.refreshToken }).expect(204);
    await request(http).post('/api/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(401);
  });

  it('A3: logout es idempotente (token ya inexistente/revocado también responde 204)', async () => {
    await request(http).post('/api/auth/logout').send({ refreshToken: 'no-existe-este-token-en-absoluto' }).expect(204);
  });
});
