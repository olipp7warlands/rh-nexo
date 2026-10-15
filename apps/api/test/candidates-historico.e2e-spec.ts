import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Histórico transversal de candidaturas (Selección, Tanda 2):
 *  - GET /candidates/historico solo ADMIN/RRHH (MANAGER/EMPLEADO 403 — no reabre el IDOR A4).
 *  - Una fila por CANDIDATURA: una persona con 2 procesos aparece 2 veces.
 *  - Filtros (puesto, sociedad, estado, rango de fechas, nombre) y paginación.
 *  - Auditoría: UNA entrada por consulta con sus filtros (no por fila) + VIEW al abrir un candidato.
 *  - Campos nuevos persistidos: Candidate.location y Job.sociedadId.
 * Crea sus propios datos con un marcador único y los limpia al terminar. Requiere Postgres de
 * TEST migrado (incluye la migración seleccion_historico_location_sociedad) y sembrado.
 */
describe('Candidatos: histórico transversal (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let adminToken: string;
  let managerToken: string;
  let empleadoToken: string;
  let rrhhUserId: string;
  const startedAt = new Date();

  const tag = `Hist${Date.now()}`;
  const personName = `${tag} Persona Multi`; // 2 candidaturas
  const otherName = `${tag} Otra Persona`; // 1 candidatura

  let sociedadId: string;
  let jobWithSociedadId: string; // oferta con sociedad
  let jobNoSociedadId: string; // oferta sin sociedad
  const candidateIds: string[] = [];
  const applicationIds: string[] = [];
  const createdJobIds: string[] = [];
  let appRejectedId: string; // la candidatura RECHAZADA de la persona multi

  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);
  const get = (token: string, qs = '') =>
    request(http).get(`/api/candidates/historico${qs}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    rrhhToken = await login('blanca.ruiz@grupo.com');
    adminToken = await login('admin@grupo.com');
    managerToken = await login('carlos.soto@grupo.com');
    empleadoToken = await login('diego.ortega@grupo.com');
    const rrhh = await db.user.findUniqueOrThrow({ where: { email: 'blanca.ruiz@grupo.com' } });
    rrhhUserId = rrhh.id;

    const sociedad = await db.sociedad.findFirst();
    if (!sociedad) throw new Error('Seed inesperado: no hay sociedades para el test del histórico');
    sociedadId = sociedad.id;

    const jobA = await db.job.create({
      data: { title: `${tag} Puesto A`, location: 'Madrid', level: 'mid', sociedadId },
    });
    const jobB = await db.job.create({ data: { title: `${tag} Puesto B`, location: 'Madrid', level: 'mid' } });
    jobWithSociedadId = jobA.id;
    jobNoSociedadId = jobB.id;
    createdJobIds.push(jobA.id, jobB.id);

    const multi = await db.candidate.create({
      data: {
        fullName: personName,
        email: `${tag.toLowerCase()}.multi@example.com`,
        location: 'Sevilla',
        linkedinUrl: 'https://linkedin.com/in/multi',
        resumeUrl: 'https://example.com/cv-multi.pdf',
      },
    });
    const other = await db.candidate.create({
      data: { fullName: otherName, email: `${tag.toLowerCase()}.otra@example.com` },
    });
    candidateIds.push(multi.id, other.id);

    // Fechas fijas y antiguas para probar el rango sin depender de "hoy".
    const a1 = await db.application.create({
      data: { jobId: jobA.id, candidateId: multi.id, status: 'CONTRATADO', appliedAt: new Date('2020-01-10T10:00:00Z') },
    });
    const a2 = await db.application.create({
      data: { jobId: jobB.id, candidateId: multi.id, status: 'RECHAZADO', appliedAt: new Date('2020-02-10T15:00:00Z') },
    });
    const a3 = await db.application.create({
      data: { jobId: jobA.id, candidateId: other.id, status: 'ACTIVO', appliedAt: new Date('2020-03-01T10:00:00Z') },
    });
    applicationIds.push(a1.id, a2.id, a3.id);
    appRejectedId = a2.id;
  });

  afterAll(async () => {
    await db.application.deleteMany({ where: { id: { in: applicationIds } } }).catch(() => undefined);
    await db.candidate.deleteMany({ where: { id: { in: candidateIds } } }).catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: createdJobIds } } }).catch(() => undefined);
    await app.close();
  });

  describe('permisos', () => {
    it('ADMIN y RRHH acceden (y `historico` no se interpreta como un :id de candidato)', async () => {
      await get(rrhhToken, `?q=${tag}`).expect(200);
      await get(adminToken, `?q=${tag}`).expect(200);
    });

    it('un MANAGER recibe 403 (no reabre el IDOR de la auditoría A4)', async () => {
      await get(managerToken).expect(403);
    });

    it('un EMPLEADO recibe 403 y sin token 401', async () => {
      await get(empleadoToken).expect(403);
      await request(http).get('/api/candidates/historico').expect(401);
    });
  });

  describe('contenido y filtros', () => {
    it('una fila por candidatura: la persona con 2 procesos aparece 2 veces, con sus campos', async () => {
      const res = await get(rrhhToken, `?q=${encodeURIComponent(personName)}`).expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(2);
      const [first, second] = res.body.items;
      expect(first.candidateId).toBe(second.candidateId);
      expect(new Set(res.body.items.map((i: { jobTitle: string }) => i.jobTitle))).toEqual(
        new Set([`${tag} Puesto A`, `${tag} Puesto B`]),
      );
      // Más reciente primero.
      expect(first.status).toBe('RECHAZADO');
      expect(first).toMatchObject({
        fullName: personName,
        location: 'Sevilla',
        linkedinUrl: 'https://linkedin.com/in/multi',
        resumeUrl: 'https://example.com/cv-multi.pdf',
        sociedad: null,
      });
      expect(second.sociedad).toMatchObject({ id: sociedadId });
      expect(second.appliedAt).toBeTruthy();
    });

    it('el buscador por nombre no distingue mayúsculas', async () => {
      const res = await get(rrhhToken, `?q=${encodeURIComponent(tag.toUpperCase())}`).expect(200);
      expect(res.body.total).toBe(3);
    });

    it('filtra por puesto, sociedad y estado', async () => {
      const byJob = await get(rrhhToken, `?q=${tag}&jobId=${jobWithSociedadId}`).expect(200);
      expect(byJob.body.total).toBe(2); // multi (CONTRATADO) + otra (ACTIVO)

      const bySociedad = await get(rrhhToken, `?q=${tag}&sociedadId=${sociedadId}`).expect(200);
      expect(bySociedad.body.items.every((i: { sociedad: { id: string } }) => i.sociedad.id === sociedadId)).toBe(true);
      expect(bySociedad.body.total).toBe(2);

      const byStatus = await get(rrhhToken, `?q=${tag}&status=RECHAZADO`).expect(200);
      expect(byStatus.body.total).toBe(1);
      expect(byStatus.body.items[0].applicationId).toBe(appRejectedId);
    });

    it('filtra por rango de fechas de postulación, con `to` inclusivo hasta fin de día', async () => {
      const enero = await get(rrhhToken, `?q=${tag}&from=2020-01-01&to=2020-01-31`).expect(200);
      expect(enero.body.total).toBe(1);

      // La candidatura del 2020-02-10 15:00Z debe entrar con to=2020-02-10 (mismo día).
      const hastaMismoDia = await get(rrhhToken, `?q=${tag}&from=2020-02-01&to=2020-02-10`).expect(200);
      expect(hastaMismoDia.body.total).toBe(1);
      expect(hastaMismoDia.body.items[0].applicationId).toBe(appRejectedId);

      const fuera = await get(rrhhToken, `?q=${tag}&from=2021-01-01`).expect(200);
      expect(fuera.body.total).toBe(0);
    });

    it('pagina en servidor', async () => {
      const p1 = await get(rrhhToken, `?q=${tag}&pageSize=2&page=1`).expect(200);
      const p2 = await get(rrhhToken, `?q=${tag}&pageSize=2&page=2`).expect(200);
      expect(p1.body.total).toBe(3);
      expect(p1.body.items).toHaveLength(2);
      expect(p2.body.items).toHaveLength(1);
      const ids = [...p1.body.items, ...p2.body.items].map((i: { applicationId: string }) => i.applicationId);
      expect(new Set(ids).size).toBe(3);
    });

    it('valida los parámetros (estado inválido, pageSize excesivo, fecha inválida → 400)', async () => {
      await get(rrhhToken, '?status=NOPE').expect(400);
      await get(rrhhToken, '?pageSize=1000').expect(400);
      await get(rrhhToken, '?from=no-es-fecha').expect(400);
    });
  });

  describe('auditoría (RGPD)', () => {
    it('registra UNA entrada por consulta con sus filtros — no una por fila', async () => {
      const marker = `${tag} Persona`;
      const before = await db.auditLog.count({
        where: { actorId: rrhhUserId, entity: 'CandidateHistory', createdAt: { gte: startedAt } },
      });
      await get(rrhhToken, `?q=${encodeURIComponent(marker)}&status=RECHAZADO`).expect(200);
      const entries = await db.auditLog.findMany({
        where: { actorId: rrhhUserId, entity: 'CandidateHistory', createdAt: { gte: startedAt } },
        orderBy: { createdAt: 'desc' },
      });
      expect(entries.length).toBe(before + 1);
      expect(entries[0].action).toBe('VIEW');
      expect(entries[0].entityId).toBeNull();
      expect(entries[0].after).toMatchObject({ filters: { q: marker, status: 'RECHAZADO' }, total: 1 });
    });

    it('una consulta rechazada por rol (MANAGER 403) no deja entrada de auditoría', async () => {
      const manager = await db.user.findUniqueOrThrow({ where: { email: 'carlos.soto@grupo.com' } });
      await get(managerToken).expect(403);
      const n = await db.auditLog.count({ where: { actorId: manager.id, entity: 'CandidateHistory' } });
      expect(n).toBe(0);
    });

    it('abrir la ficha de un candidato (GET /candidates/:id) registra un VIEW de ese candidato', async () => {
      const id = candidateIds[0];
      await request(http).get(`/api/candidates/${id}`).set('Authorization', `Bearer ${rrhhToken}`).expect(200);
      const view = await db.auditLog.findFirst({
        where: { actorId: rrhhUserId, action: 'VIEW', entity: 'Candidate', entityId: id },
      });
      expect(view).not.toBeNull();
    });
  });

  describe('campos nuevos persisten', () => {
    it('POST /candidates guarda `location`', async () => {
      const res = await request(http)
        .post('/api/candidates')
        .set('Authorization', `Bearer ${rrhhToken}`)
        .send({ fullName: `${tag} Con Ubicación`, email: `${tag.toLowerCase()}.ubi@example.com`, location: 'Valencia' })
        .expect(201);
      candidateIds.push(res.body.id);
      const row = await db.candidate.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.location).toBe('Valencia');
    });

    it('POST /jobs guarda `sociedadId` y GET /jobs/:id devuelve la sociedad', async () => {
      const res = await request(http)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${rrhhToken}`)
        .send({ title: `${tag} Oferta Sociedad`, location: 'Madrid', level: 'mid', sociedadId })
        .expect(201);
      createdJobIds.push(res.body.id);
      const row = await db.job.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.sociedadId).toBe(sociedadId);

      const detail = await request(http).get(`/api/jobs/${res.body.id}`).set('Authorization', `Bearer ${rrhhToken}`).expect(200);
      expect(detail.body.sociedad).toMatchObject({ id: sociedadId });
    });

    it('POST /jobs con una sociedad inexistente responde 400 (no 500)', async () => {
      await request(http)
        .post('/api/jobs')
        .set('Authorization', `Bearer ${rrhhToken}`)
        .send({ title: `${tag} Oferta Mala`, location: 'Madrid', level: 'mid', sociedadId: 'no-existe' })
        .expect(400);
    });
  });
});
