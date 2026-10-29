import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Historial de etapas (ApplicationEtapa) y alta por contratación:
 *  - crear candidatura registra la etapa inicial; moverla, el cribado automático y contratar registran cada cambio;
 *  - contratar con una localización que no existe exige país (nunca se crea una localización sin él) y lo audita.
 * Datos propios con marcador único; requiere Postgres de TEST migrado y sembrado.
 */
describe('Historial de etapas y contratación (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let rrhhUserId: string;
  const tag = `Etapa${Date.now()}`;
  const jobIds: string[] = [];
  const candidateIds: string[] = [];
  const locIds: string[] = [];
  const employeeIds: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);

  const newJob = async (location = 'Madrid', openedAt?: string) => {
    const res = await request(http)
      .post('/api/jobs')
      .set(auth(rrhhToken))
      .send({ title: `${tag} puesto`, location, level: 'mid', ...(openedAt ? { openedAt } : {}) })
      .expect(201);
    jobIds.push(res.body.id);
    return res.body.id as string;
  };
  const newApplication = async (jobId: string, appliedAt?: string, withCv = false) => {
    const cand = await request(http)
      .post('/api/candidates')
      .set(auth(rrhhToken))
      .send({ fullName: `${tag} Cand`, email: `${tag}.${Math.random().toString(36).slice(2)}@example.com`, ...(withCv ? { resumeUrl: 'https://example.com/cv.pdf' } : {}) })
      .expect(201);
    candidateIds.push(cand.body.id);
    const res = await request(http)
      .post('/api/applications')
      .set(auth(rrhhToken))
      .send({ jobId, candidateId: cand.body.id, ...(appliedAt ? { appliedAt } : {}) })
      .expect(201);
    return { id: res.body.id as string, candidateId: cand.body.id as string };
  };
  const etapas = (applicationId: string) =>
    db.applicationEtapa.findMany({ where: { applicationId }, include: { stage: true }, orderBy: { enteredAt: 'asc' } });
  const stageId = async (name: string) => (await db.stage.findUniqueOrThrow({ where: { name } })).id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    rrhhToken = await login('blanca.ruiz@grupo.com');
    rrhhUserId = (await db.user.findUniqueOrThrow({ where: { email: 'blanca.ruiz@grupo.com' } })).id;
  });

  afterAll(async () => {
    const apps = await db.application.findMany({ where: { jobId: { in: jobIds } }, select: { id: true } });
    const appIds = apps.map((a) => a.id);
    const procesos = await db.proceso.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
    await db.procesoTarea.deleteMany({ where: { procesoId: { in: procesos.map((p) => p.id) } } }).catch(() => undefined);
    await db.proceso.deleteMany({ where: { employeeId: { in: employeeIds } } }).catch(() => undefined);
    await db.auditDecision.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.evaluation.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.interview.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.employee.deleteMany({ where: { id: { in: employeeIds } } }).catch(() => undefined);
    await db.application.deleteMany({ where: { id: { in: appIds } } }).catch(() => undefined); // las etapas caen en cascada
    await db.candidate.deleteMany({ where: { id: { in: candidateIds } } }).catch(() => undefined);
    await db.auditLog
      .deleteMany({ where: { entityId: { in: [...jobIds, ...appIds, ...candidateIds, ...locIds, ...employeeIds] } } })
      .catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: jobIds } } }).catch(() => undefined);
    await db.localizacion.deleteMany({ where: { id: { in: locIds } } }).catch(() => undefined);
    await app.close();
  });

  describe('historial de etapas', () => {
    it('crear la candidatura registra la etapa inicial con quién y cuándo (fecha real de postulación si se indicó)', async () => {
      const jobId = await newJob('Madrid', '2026-08-01');
      const a = await newApplication(jobId, '2026-09-01');
      const rows = await etapas(a.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.stage.name).toBe('Nuevo');
      expect(rows[0]!.byUserId).toBe(rrhhUserId);
      expect(rows[0]!.enteredAt.toISOString().slice(0, 10)).toBe('2026-09-01');
    });

    it('mover de etapa añade una fila por cada cambio, en orden', async () => {
      const a = await newApplication(await newJob());
      const cribado = await stageId('Cribado');
      const entrevista = await stageId('Entrevista');
      await request(http).patch(`/api/applications/${a.id}/stage`).set(auth(rrhhToken)).send({ stageId: cribado }).expect(200);
      await request(http).patch(`/api/applications/${a.id}/stage`).set(auth(rrhhToken)).send({ stageId: entrevista }).expect(200);
      const rows = await etapas(a.id);
      expect(rows.map((r) => r.stage.name)).toEqual(['Nuevo', 'Cribado', 'Entrevista']);
      expect(rows.every((r) => r.byUserId === rrhhUserId)).toBe(true);
    });

    it('el cribado automático registra el avance Nuevo → Cribado', async () => {
      const jobId = await newJob();
      const a = await newApplication(jobId, undefined, true);
      // El cribado avanza a quien tiene CV (Candidate.resumeUrl); aseguramos el dato directamente.
      await db.candidate.update({ where: { id: a.candidateId }, data: { resumeUrl: 'https://example.com/cv.pdf' } });
      await request(http).post(`/api/applications/screen/${jobId}`).set(auth(rrhhToken)).expect(201);
      expect((await etapas(a.id)).map((r) => r.stage.name)).toEqual(['Nuevo', 'Cribado']);
    });

    it('una etapa fallida (inexistente) no deja filas de más', async () => {
      const a = await newApplication(await newJob());
      await request(http).patch(`/api/applications/${a.id}/stage`).set(auth(rrhhToken)).send({ stageId: 'no-existe' }).expect(404);
      expect(await etapas(a.id)).toHaveLength(1);
    });
  });

  describe('contratación y localizaciones', () => {
    const hire = (id: string, body: Record<string, unknown>) =>
      request(http).post(`/api/applications/${id}/hire`).set(auth(rrhhToken)).send({ startDate: '2031-01-01', ...body });

    it('localización nueva SIN país → 400 y no se crea nada (ni localización ni empleado)', async () => {
      const name = `${tag} Sede nueva`;
      const a = await newApplication(await newJob(name));
      const res = await hire(a.id, {}).expect(400);
      expect(JSON.stringify(res.body)).toContain('indica su país');
      expect(await db.localizacion.findFirst({ where: { nombre: name } })).toBeNull();
      expect(await db.employee.findFirst({ where: { candidateId: a.candidateId } })).toBeNull();
      expect(await db.application.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: 'ACTIVO' });
    });

    it('país inexistente → 400; con país válido crea la localización con su país, la audita y registra la etapa Contratado', async () => {
      const name = `${tag} Sede con país`;
      const a = await newApplication(await newJob(name));
      await hire(a.id, { paisId: 'no-existe' }).expect(400);
      expect(await db.localizacion.findFirst({ where: { nombre: name } })).toBeNull();

      const res = await hire(a.id, { paisId: 'p-es' }).expect(201);
      employeeIds.push(res.body.employee.id);
      const loc = await db.localizacion.findFirstOrThrow({ where: { nombre: name } });
      locIds.push(loc.id);
      expect(loc.paisId).toBe('p-es');
      expect(res.body.employee.localizacionId).toBe(loc.id);

      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Localizacion', entityId: loc.id, action: 'CREATE' } });
      expect(log.after).toMatchObject({ nombre: name, paisId: 'p-es', origen: 'contratación' });
      expect((await etapas(a.id)).map((r) => r.stage.name)).toEqual(['Nuevo', 'Contratado']);
    });

    it('localización que ya existe (sin distinguir mayúsculas): no pide país y no crea otra', async () => {
      const loc = await db.localizacion.create({ data: { nombre: `${tag} Sede previa`, paisId: 'p-es' } });
      locIds.push(loc.id);
      const a = await newApplication(await newJob(loc.nombre.toUpperCase()));
      const before = await db.localizacion.count();
      const res = await hire(a.id, {}).expect(201);
      employeeIds.push(res.body.employee.id);
      expect(res.body.employee.localizacionId).toBe(loc.id);
      expect(await db.localizacion.count()).toBe(before);
    });
  });
});
