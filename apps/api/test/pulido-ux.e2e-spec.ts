import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Mini-tanda «Pulido UX Selección»:
 *  - PATCH /jobs/:id acepta título y departamento (no vacíos, departamento existente) y se audita.
 *  - DELETE /interviews/:id solo para entrevistas PROGRAMADA, con permisos y entrada en AuditLog.
 * Crea sus datos con un marcador único y los limpia. Requiere Postgres de TEST migrado y sembrado.
 */
describe('Pulido UX Selección (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let empToken: string;
  const tag = `PulUx${Date.now()}`;
  const jobIds: string[] = [];
  const candidateIds: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);

  const newJob = async () => {
    const res = await request(http)
      .post('/api/jobs')
      .set(auth(rrhhToken))
      .send({ title: `${tag} puesto`, location: 'Madrid', level: 'mid' })
      .expect(201);
    jobIds.push(res.body.id);
    return res.body as { id: string };
  };

  const newApplication = async () => {
    const job = await newJob();
    const cand = await request(http)
      .post('/api/candidates')
      .set(auth(rrhhToken))
      .send({ fullName: `${tag} Candidato`, email: `${tag}.${Math.random().toString(36).slice(2)}@example.com` })
      .expect(201);
    candidateIds.push(cand.body.id);
    const res = await request(http)
      .post('/api/applications')
      .set(auth(rrhhToken))
      .send({ jobId: job.id, candidateId: cand.body.id })
      .expect(201);
    return res.body.id as string;
  };

  const addInterview = (applicationId: string) =>
    request(http).post(`/api/applications/${applicationId}/interviews`).set(auth(rrhhToken)).send({ type: 'cultural' });

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
  });

  afterAll(async () => {
    const apps = await db.application.findMany({ where: { jobId: { in: jobIds } }, select: { id: true } });
    const appIds = apps.map((a) => a.id);
    const interviews = await db.interview.findMany({ where: { applicationId: { in: appIds } }, select: { id: true } });
    await db.interview.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.application.deleteMany({ where: { id: { in: appIds } } }).catch(() => undefined);
    await db.candidate.deleteMany({ where: { id: { in: candidateIds } } }).catch(() => undefined);
    await db.auditLog
      .deleteMany({ where: { entityId: { in: [...jobIds, ...appIds, ...candidateIds, ...interviews.map((i) => i.id), ...createdInterviewIds] } } })
      .catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: jobIds } } }).catch(() => undefined);
    await app.close();
  });

  const createdInterviewIds: string[] = [];

  describe('editar título y departamento de la oferta', () => {
    it('cambia el título y el departamento, persiste y deja entrada UPDATE con before/after', async () => {
      const job = await newJob();
      const dep = await db.department.findFirstOrThrow();
      const res = await request(http)
        .patch(`/api/jobs/${job.id}`)
        .set(auth(rrhhToken))
        .send({ title: `  ${tag} renombrado  `, departmentId: dep.id })
        .expect(200);
      expect(res.body.title).toBe(`${tag} renombrado`);
      expect(res.body.departmentId).toBe(dep.id);

      const stored = await db.job.findUniqueOrThrow({ where: { id: job.id } });
      expect(stored.title).toBe(`${tag} renombrado`);
      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Job', entityId: job.id, action: 'UPDATE' } });
      expect((log.before as { title: string }).title).toBe(`${tag} puesto`);
      expect((log.after as { title: string }).title).toBe(`${tag} renombrado`);
    });

    it.each(['', '   '])('rechaza un título vacío (%j) con 400 y no modifica la oferta', async (title) => {
      const job = await newJob();
      await request(http).patch(`/api/jobs/${job.id}`).set(auth(rrhhToken)).send({ title }).expect(400);
      expect((await db.job.findUniqueOrThrow({ where: { id: job.id } })).title).toBe(`${tag} puesto`);
    });

    it('rechaza un departamento inexistente con 400', async () => {
      const job = await newJob();
      await request(http).patch(`/api/jobs/${job.id}`).set(auth(rrhhToken)).send({ departmentId: 'no-existe' }).expect(400);
    });

    it('un EMPLEADO no puede editar la oferta (403)', async () => {
      const job = await newJob();
      await request(http).patch(`/api/jobs/${job.id}`).set(auth(empToken)).send({ title: 'x' }).expect(403);
    });

    it('la descripción legada sigue siendo editable por PATCH', async () => {
      const job = await newJob();
      const res = await request(http)
        .patch(`/api/jobs/${job.id}`)
        .set(auth(rrhhToken))
        .send({ description: 'Texto anterior editado' })
        .expect(200);
      expect(res.body.description).toBe('Texto anterior editado');
    });
  });

  describe('eliminar entrevista programada', () => {
    it('varias entrevistas por candidatura: borra solo la indicada y audita DELETE con el contenido', async () => {
      const appId = await newApplication();
      const a = (await addInterview(appId).expect(201)).body.id as string;
      const b = (await addInterview(appId).expect(201)).body.id as string;
      createdInterviewIds.push(a, b);

      const res = await request(http).delete(`/api/interviews/${a}`).set(auth(rrhhToken)).expect(200);
      expect(res.body).toEqual({ id: a, deleted: true });
      expect(await db.interview.findUnique({ where: { id: a } })).toBeNull();
      expect(await db.interview.findUnique({ where: { id: b } })).not.toBeNull();

      const log = await db.auditLog.findFirstOrThrow({ where: { entity: 'Interview', entityId: a, action: 'DELETE' } });
      expect((log.before as { type: string }).type).toBe('cultural');
    });

    it('una entrevista completada no se borra (409) y permanece', async () => {
      const appId = await newApplication();
      const id = (await addInterview(appId).expect(201)).body.id as string;
      createdInterviewIds.push(id);
      await request(http).patch(`/api/interviews/${id}`).set(auth(rrhhToken)).send({ status: 'COMPLETADA' }).expect(200);
      await request(http).delete(`/api/interviews/${id}`).set(auth(rrhhToken)).expect(409);
      expect(await db.interview.findUnique({ where: { id } })).not.toBeNull();
    });

    it('un EMPLEADO no puede borrar (403) y una id inexistente da 404', async () => {
      const appId = await newApplication();
      const id = (await addInterview(appId).expect(201)).body.id as string;
      createdInterviewIds.push(id);
      await request(http).delete(`/api/interviews/${id}`).set(auth(empToken)).expect(403);
      expect(await db.interview.findUnique({ where: { id } })).not.toBeNull();
      await request(http).delete('/api/interviews/no-existe').set(auth(rrhhToken)).expect(404);
    });
  });
});
