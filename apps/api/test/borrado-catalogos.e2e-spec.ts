import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Protección de borrado de catálogos y festivos:
 *  - Sociedad / Proyecto / Departamento con ofertas, y Localización con festivos, devuelven 409 con el
 *    motivo y NO se borra ni se desvincula nada (antes se desvinculaban en silencio / se borraban en cascada).
 *  - Los listados exponen los conteos que la UI usa para deshabilitar «Eliminar» con su motivo.
 *  - DELETE /holidays/:id solo para festivos pendientes; uno validado exige marcarlo pendiente antes. Auditado.
 * Datos propios con marcador único; requiere Postgres de TEST migrado y sembrado.
 */
describe('Borrado de catálogos y festivos (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let empToken: string;
  const tag = `Borr${Date.now()}`;
  const ids = { jobs: [] as string[], holidays: [] as string[], locs: [] as string[], socs: [] as string[], proys: [] as string[], deps: [] as string[], paises: [] as string[] };
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);
  let paisId: string;

  const newJob = async (extra: Record<string, unknown>) => {
    const res = await request(http)
      .post('/api/jobs')
      .set(auth(rrhhToken))
      .send({ title: `${tag} oferta`, location: 'Madrid', level: 'mid', ...extra })
      .expect(201);
    ids.jobs.push(res.body.id);
    return res.body.id as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    rrhhToken = await login('blanca.ruiz@grupo.com');
    empToken = await login('diego.ortega@grupo.com');
    paisId = (await db.pais.create({ data: { nombre: `${tag} Pais` } })).id;
    ids.paises.push(paisId);
  });

  afterAll(async () => {
    await db.job.deleteMany({ where: { id: { in: ids.jobs } } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { entityId: { in: [...ids.jobs, ...ids.holidays] } } }).catch(() => undefined);
    await db.holiday.deleteMany({ where: { id: { in: ids.holidays } } }).catch(() => undefined);
    await db.sociedad.deleteMany({ where: { id: { in: ids.socs } } }).catch(() => undefined);
    await db.proyecto.deleteMany({ where: { id: { in: ids.proys } } }).catch(() => undefined);
    await db.department.deleteMany({ where: { id: { in: ids.deps } } }).catch(() => undefined);
    await db.localizacion.deleteMany({ where: { id: { in: ids.locs } } }).catch(() => undefined);
    await db.pais.deleteMany({ where: { id: { in: ids.paises } } }).catch(() => undefined);
    await app.close();
  });

  describe('referencias que bloquean el borrado (409 con motivo; nada se desvincula)', () => {
    it('Sociedad con una oferta: 409, la oferta conserva su sociedad; el listado trae el conteo; sin referencias se borra', async () => {
      const soc = await db.sociedad.create({ data: { nombre: `${tag} Soc`, paisId } });
      ids.socs.push(soc.id);
      const jobId = await newJob({ sociedadId: soc.id });

      const del = await request(http).delete(`/api/sociedades/${soc.id}`).set(auth(rrhhToken)).expect(409);
      expect(JSON.stringify(del.body)).toContain('la sociedad');
      expect(JSON.stringify(del.body)).toContain('1 oferta');
      expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).sociedadId).toBe(soc.id);

      const list = await request(http).get('/api/sociedades').set(auth(rrhhToken)).expect(200);
      expect(list.body.find((s: { id: string }) => s.id === soc.id)._count).toMatchObject({ empleados: 0, jobs: 1 });

      await db.job.update({ where: { id: jobId }, data: { sociedadId: null } });
      await request(http).delete(`/api/sociedades/${soc.id}`).set(auth(rrhhToken)).expect(200);
    });

    it('Proyecto con una oferta: 409 y la oferta conserva su proyecto', async () => {
      const p = await db.proyecto.create({ data: { nombre: `${tag} Proyecto` } });
      ids.proys.push(p.id);
      const jobId = await newJob({ proyectoId: p.id });
      const del = await request(http).delete(`/api/proyectos/${p.id}`).set(auth(rrhhToken)).expect(409);
      expect(JSON.stringify(del.body)).toContain('1 oferta');
      expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).proyectoId).toBe(p.id);
      const list = await request(http).get('/api/proyectos').set(auth(rrhhToken)).expect(200);
      expect(list.body.find((x: { id: string }) => x.id === p.id)._count.jobs).toBe(1);
    });

    it('Departamento con una oferta: 409 y la oferta conserva su departamento', async () => {
      const d = await db.department.create({ data: { name: `${tag} Dep`, color: '#999999' } });
      ids.deps.push(d.id);
      const jobId = await newJob({ departmentId: d.id });
      const del = await request(http).delete(`/api/departments/${d.id}`).set(auth(rrhhToken)).expect(409);
      expect(JSON.stringify(del.body)).toContain('1 oferta');
      expect((await db.job.findUniqueOrThrow({ where: { id: jobId } })).departmentId).toBe(d.id);
      const list = await request(http).get('/api/departments').set(auth(rrhhToken)).expect(200);
      expect(list.body.find((x: { id: string }) => x.id === d.id)._count.jobs).toBe(1);
    });

    it('Localización con festivos: 409 con el conteo y los festivos siguen ahí; sin festivos se borra', async () => {
      const loc = await db.localizacion.create({ data: { nombre: `${tag} Loc`, paisId } });
      ids.locs.push(loc.id);
      const h1 = await db.holiday.create({ data: { date: new Date('2032-03-01'), name: `${tag} F1`, localizacionId: loc.id } });
      const h2 = await db.holiday.create({ data: { date: new Date('2032-03-02'), name: `${tag} F2`, localizacionId: loc.id, validado: true } });
      ids.holidays.push(h1.id, h2.id);

      const del = await request(http).delete(`/api/localizaciones/${loc.id}`).set(auth(rrhhToken)).expect(409);
      expect(JSON.stringify(del.body)).toContain('2 festivos');
      expect(await db.holiday.count({ where: { localizacionId: loc.id } })).toBe(2);

      const list = await request(http).get('/api/localizaciones').set(auth(rrhhToken)).expect(200);
      expect(list.body.find((x: { id: string }) => x.id === loc.id)._count).toMatchObject({ empleados: 0, festivos: 2 });

      await db.holiday.deleteMany({ where: { localizacionId: loc.id } });
      await request(http).delete(`/api/localizaciones/${loc.id}`).set(auth(rrhhToken)).expect(200);
    });

    it('con personas y ofertas a la vez el motivo cita ambas', async () => {
      const soc = await db.sociedad.create({ data: { nombre: `${tag} Soc2`, paisId } });
      ids.socs.push(soc.id);
      const tipo = await db.tipoContrato.findFirstOrThrow();
      const emp = await db.employee.create({
        data: { fullName: `${tag} P`, email: `${tag}.p@example.com`, jobTitle: 'x', level: 'mid', startDate: new Date('2026-01-01'), localizacionId: 'loc-madrid', tipoContratoId: tipo.id, sociedadId: soc.id },
      });
      await newJob({ sociedadId: soc.id });
      try {
        const del = await request(http).delete(`/api/sociedades/${soc.id}`).set(auth(rrhhToken)).expect(409);
        expect(JSON.stringify(del.body)).toContain('1 persona y 1 oferta');
      } finally {
        await db.employee.delete({ where: { id: emp.id } });
      }
    });
  });

  describe('DELETE /holidays/:id', () => {
    const mk = async (validado: boolean, name: string) => {
      const h = await db.holiday.create({ data: { date: new Date('2032-06-01'), name: `${tag} ${name}`, paisId, validado, fuente: 'https://example.org' } });
      ids.holidays.push(h.id);
      return h;
    };

    it('un festivo pendiente se elimina y queda auditado con su contenido', async () => {
      const h = await mk(false, 'Pendiente');
      const res = await request(http).delete(`/api/holidays/${h.id}`).set(auth(rrhhToken)).expect(200);
      expect(res.body).toEqual({ id: h.id, deleted: true });
      expect(await db.holiday.findUnique({ where: { id: h.id } })).toBeNull();
      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Holiday', entityId: h.id, action: 'DELETE' } });
      expect(log.before).toMatchObject({ name: `${tag} Pendiente`, validado: false, date: '2032-06-01' });
    });

    it('un festivo validado NO se elimina (409); marcándolo pendiente antes sí', async () => {
      const h = await mk(true, 'Validado');
      const no = await request(http).delete(`/api/holidays/${h.id}`).set(auth(rrhhToken)).expect(409);
      expect(JSON.stringify(no.body)).toContain('márcalo primero como pendiente');
      expect(await db.holiday.findUnique({ where: { id: h.id } })).not.toBeNull();

      await request(http).patch(`/api/holidays/${h.id}`).set(auth(rrhhToken)).send({ validado: false }).expect(200);
      await request(http).delete(`/api/holidays/${h.id}`).set(auth(rrhhToken)).expect(200);
      expect(await db.holiday.findUnique({ where: { id: h.id } })).toBeNull();
    });

    it('EMPLEADO no puede (403) y un id inexistente da 404', async () => {
      const h = await mk(false, 'Ajeno');
      await request(http).delete(`/api/holidays/${h.id}`).set(auth(empToken)).expect(403);
      expect(await db.holiday.findUnique({ where: { id: h.id } })).not.toBeNull();
      await request(http).delete('/api/holidays/no-existe').set(auth(rrhhToken)).expect(404);
    });
  });
});
