import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Selección II · Tanda 1 — fechas reales de proceso y filtros del histórico:
 *  - Oferta: apertura/cierre editables; cierre solo con CERRADA; cierre >= apertura; al REABRIR
 *    closedAt vuelve a NULL; proyecto validado. Solo ADMIN/RRHH escriben.
 *  - Candidatura: postulación editable (>= apertura) y fecha de incorporación solo en CONTRATADO.
 *  - Histórico: filtros por ubicación y proyecto, y su rastro en AuditLog.
 * Crea sus datos con un marcador único y los limpia. Requiere Postgres de TEST migrado y sembrado.
 */
describe('Selección II: fechas de proceso y filtros (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let managerToken: string;
  let proyectoId: string;
  const tag = `SelII${Date.now()}`;
  const jobIds: string[] = [];
  const candidateIds: string[] = [];
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);
  const newJob = (body: Record<string, unknown>) =>
    request(http).post('/api/jobs').set(auth(rrhhToken)).send({ title: `${tag} ${Math.random()}`, location: 'Madrid', level: 'mid', ...body });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);
    rrhhToken = await login('blanca.ruiz@grupo.com');
    managerToken = await login('carlos.soto@grupo.com');
    const p = await db.proyecto.create({ data: { nombre: `${tag} Proyecto` } });
    proyectoId = p.id;
  });

  afterAll(async () => {
    await db.application.deleteMany({ where: { jobId: { in: jobIds } } }).catch(() => undefined);
    await db.candidate.deleteMany({ where: { id: { in: candidateIds } } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { entity: 'Job', entityId: { in: jobIds } } }).catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: jobIds } } }).catch(() => undefined);
    await db.proyecto.delete({ where: { id: proyectoId } }).catch(() => undefined);
    await app.close();
  });

  describe('ofertas: apertura, cierre y reapertura', () => {
    it('crea una oferta CERRADA con fechas reales de 2025 y las devuelve (openedAt ya no es "hoy")', async () => {
      const res = await newJob({ status: 'CERRADA', openedAt: '2025-03-03', closedAt: '2025-05-16', proyectoId }).expect(201);
      jobIds.push(res.body.id);
      expect(res.body.status).toBe('CERRADA');
      expect(res.body.openedAt).toBe('2025-03-03T00:00:00.000Z');
      expect(res.body.closedAt).toBe('2025-05-16T00:00:00.000Z');
      expect(res.body.proyectoId).toBe(proyectoId);
      const list = await request(http).get('/api/jobs').set(auth(rrhhToken)).expect(200);
      const found = list.body.find((j: { id: string }) => j.id === res.body.id);
      expect(found.openedAt).toBe('2025-03-03T00:00:00.000Z');
      expect(found.proyecto.nombre).toBe(`${tag} Proyecto`);
    });

    it('sin fechas: apertura = ahora, sin cierre', async () => {
      const res = await newJob({}).expect(201);
      jobIds.push(res.body.id);
      expect(res.body.status).toBe('ABIERTA');
      expect(Math.abs(Date.now() - new Date(res.body.openedAt).getTime())).toBeLessThan(60_000);
      expect(res.body.closedAt).toBeNull();
    });

    it('rechaza cierre anterior a la apertura (400) y cierre en una oferta no cerrada (400)', async () => {
      await newJob({ status: 'CERRADA', openedAt: '2025-06-01', closedAt: '2025-05-31' }).expect(400);
      await newJob({ status: 'ABIERTA', openedAt: '2025-06-01', closedAt: '2025-07-01' }).expect(400);
    });

    it('cierre el mismo día que la apertura es válido (>=)', async () => {
      const res = await newJob({ status: 'CERRADA', openedAt: '2025-06-01', closedAt: '2025-06-01' }).expect(201);
      jobIds.push(res.body.id);
    });

    it('REABRIR pone closedAt a NULL; volver a cerrar sin fecha usa hoy; editar la apertura a posterior al cierre da 400', async () => {
      const created = await newJob({ status: 'CERRADA', openedAt: '2025-01-10', closedAt: '2025-02-10' }).expect(201);
      const id = created.body.id as string;
      jobIds.push(id);

      const reopened = await request(http).patch(`/api/jobs/${id}`).set(auth(rrhhToken)).send({ status: 'ABIERTA' }).expect(200);
      expect(reopened.body.status).toBe('ABIERTA');
      expect(reopened.body.closedAt).toBeNull();
      expect((await db.job.findUniqueOrThrow({ where: { id } })).closedAt).toBeNull();

      const closed = await request(http).patch(`/api/jobs/${id}`).set(auth(rrhhToken)).send({ status: 'CERRADA' }).expect(200);
      expect(new Date(closed.body.closedAt).toISOString().slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));

      await request(http)
        .patch(`/api/jobs/${id}`)
        .set(auth(rrhhToken))
        .send({ openedAt: '2999-01-01' })
        .expect(400);
    });

    it('proyecto inexistente = 400; MANAGER no puede crear ni editar ofertas (403)', async () => {
      await newJob({ proyectoId: 'no-existe' }).expect(400);
      await request(http).post('/api/jobs').set(auth(managerToken)).send({ title: 'x', location: 'x', level: 'x' }).expect(403);
      await request(http).patch(`/api/jobs/${jobIds[0]}`).set(auth(managerToken)).send({ status: 'ABIERTA' }).expect(403);
    });

    it('la edición queda en AuditLog con antes/después', async () => {
      const id = jobIds[0];
      await request(http).patch(`/api/jobs/${id}`).set(auth(rrhhToken)).send({ openedAt: '2025-03-04' }).expect(200);
      const log = await db.auditLog.findFirst({ where: { entity: 'Job', entityId: id, action: 'UPDATE' }, orderBy: { createdAt: 'desc' } });
      expect((log?.before as { openedAt: string }).openedAt).toBe('2025-03-03T00:00:00.000Z');
      expect((log?.after as { openedAt: string }).openedAt).toBe('2025-03-04T00:00:00.000Z');
    });
  });

  describe('candidaturas: postulación e incorporación', () => {
    let jobId: string;
    let candidateId: string;
    let applicationId: string;

    beforeAll(async () => {
      const job = await newJob({ openedAt: '2025-03-03' }).expect(201);
      jobId = job.body.id;
      jobIds.push(jobId);
      const cand = await db.candidate.create({
        data: { fullName: `${tag} Candidata`, email: `${tag.toLowerCase()}@example.com`, location: 'Valencia (España)' },
      });
      candidateId = cand.id;
      candidateIds.push(candidateId);
    });

    it('postulación anterior a la apertura = 400; válida se persiste con la fecha indicada', async () => {
      await request(http).post('/api/applications').set(auth(rrhhToken)).send({ jobId, candidateId, appliedAt: '2025-03-02' }).expect(400);
      const ok = await request(http).post('/api/applications').set(auth(rrhhToken)).send({ jobId, candidateId, appliedAt: '2025-03-10' }).expect(201);
      applicationId = ok.body.id;
      expect(ok.body.appliedAt).toBe('2025-03-10T00:00:00.000Z');
    });

    it('PATCH fechas: solo ADMIN/RRHH; incorporación solo en CONTRATADO y >= postulación; auditado', async () => {
      await request(http).patch(`/api/applications/${applicationId}`).set(auth(managerToken)).send({ appliedAt: '2025-03-11' }).expect(403);
      await request(http).patch(`/api/applications/${applicationId}`).set(auth(rrhhToken)).send({ appliedAt: '2025-03-02' }).expect(400);
      // ACTIVO: no admite incorporación
      await request(http).patch(`/api/applications/${applicationId}`).set(auth(rrhhToken)).send({ fechaIncorporacion: '2025-06-02' }).expect(400);

      const upd = await request(http).patch(`/api/applications/${applicationId}`).set(auth(rrhhToken)).send({ appliedAt: '2025-03-12' }).expect(200);
      expect(upd.body.appliedAt).toBe('2025-03-12T00:00:00.000Z');

      await db.application.update({ where: { id: applicationId }, data: { status: 'CONTRATADO' } });
      await request(http).patch(`/api/applications/${applicationId}`).set(auth(rrhhToken)).send({ fechaIncorporacion: '2025-03-01' }).expect(400);
      const inc = await request(http).patch(`/api/applications/${applicationId}`).set(auth(rrhhToken)).send({ fechaIncorporacion: '2025-06-02' }).expect(200);
      expect(inc.body.fechaIncorporacion).toBe('2025-06-02T00:00:00.000Z');

      const log = await db.auditLog.findFirst({ where: { entity: 'Application', entityId: applicationId, action: 'UPDATE' }, orderBy: { createdAt: 'desc' } });
      expect((log?.after as { fechaIncorporacion: string }).fechaIncorporacion).toBe('2025-06-02T00:00:00.000Z');
    });

    it('el histórico devuelve postulación, incorporación y proyecto, y filtra por ubicación y por proyecto', async () => {
      // La oferta con proyecto es la primera creada; ligamos esta candidatura a ella.
      await db.job.update({ where: { id: jobId }, data: { proyectoId } });
      const base = `?q=${encodeURIComponent(tag)}`;
      const all = await request(http).get(`/api/candidates/historico${base}`).set(auth(rrhhToken)).expect(200);
      expect(all.body.total).toBe(1);
      expect(all.body.items[0]).toMatchObject({
        appliedAt: '2025-03-12T00:00:00.000Z',
        fechaIncorporacion: '2025-06-02T00:00:00.000Z',
        proyecto: { id: proyectoId },
      });

      const porUbi = await request(http).get(`/api/candidates/historico${base}&location=valencia`).set(auth(rrhhToken)).expect(200);
      expect(porUbi.body.total).toBe(1);
      const sinUbi = await request(http).get(`/api/candidates/historico${base}&location=tokio`).set(auth(rrhhToken)).expect(200);
      expect(sinUbi.body.total).toBe(0);

      const porProy = await request(http).get(`/api/candidates/historico${base}&proyectoId=${proyectoId}`).set(auth(rrhhToken)).expect(200);
      expect(porProy.body.total).toBe(1);
      const otroProy = await request(http).get(`/api/candidates/historico${base}&proyectoId=otro`).set(auth(rrhhToken)).expect(200);
      expect(otroProy.body.total).toBe(0);

      const log = await db.auditLog.findFirst({ where: { entity: 'CandidateHistory' }, orderBy: { createdAt: 'desc' } });
      expect((log?.after as { filters: Record<string, unknown> }).filters).toMatchObject({ proyectoId: 'otro', location: null });
    });

    it('filtros del histórico: MANAGER sigue en 403', async () => {
      await request(http).get('/api/candidates/historico?location=x&proyectoId=x').set(auth(managerToken)).expect(403);
    });
  });
});
