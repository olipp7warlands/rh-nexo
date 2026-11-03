import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Analítica de procesos (GET /reports/seleccion): conteos por año/mes, tiempos de cierre, embudo,
 * línea temporal por oferta, permisos y auditoría. Datos FIJOS aislados con una sociedad propia
 * (el filtro sociedadId excluye cualquier otra oferta del seed). Se limpian al terminar.
 *
 * Ofertas (todas de la sociedad de prueba):
 *   J1 abre 2025-01-10, cierra 2025-01-30 (20 d)  — 2 candidaturas: CONTRATADO (incorpora 2025-02-15) + RECHAZADO
 *   J2 abre 2025-01-20, cierra 2025-03-21 (60 d)  — 1 candidatura ACTIVO con historial de etapas + 1 entrevista
 *   J3 abre 2025-03-05, sigue ABIERTA             — sin candidaturas
 *   J4 abre 2026-02-01, cierra 2026-02-11 (10 d)  — sin candidaturas
 */
describe('Analítica de procesos de Selección (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let rrhhToken: string;
  let adminToken: string;
  let managerToken: string;
  let empleadoToken: string;
  const startedAt = new Date();

  const tag = `Anal${Date.now()}`;
  let sociedadId: string;
  let paisId: string;
  const jobIds: Record<'j1' | 'j2' | 'j3' | 'j4', string> = { j1: '', j2: '', j3: '', j4: '' };
  const candidateIds: string[] = [];
  const candidateNames = [`${tag} Nombre Uno`, `${tag} Nombre Dos`, `${tag} Nombre Tres`];

  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken as string);
  const get = (token: string, qs = '') =>
    request(http).get(`/api/reports/seleccion?sociedadId=${sociedadId}${qs}`).set('Authorization', `Bearer ${token}`);

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

    const pais = await db.pais.findFirstOrThrow();
    paisId = pais.id;
    sociedadId = (await db.sociedad.create({ data: { nombre: `${tag} SL`, paisId } })).id;

    const mk = (title: string, openedAt: string, closedAt: string | null, status: 'ABIERTA' | 'CERRADA') =>
      db.job.create({
        data: { title: `${tag} ${title}`, location: 'Madrid', level: 'mid', status, sociedadId, openedAt: new Date(openedAt), closedAt: closedAt ? new Date(closedAt) : null },
      });
    jobIds.j1 = (await mk('J1', '2025-01-10T10:00:00Z', '2025-01-30T10:00:00Z', 'CERRADA')).id;
    jobIds.j2 = (await mk('J2', '2025-01-20T10:00:00Z', '2025-03-21T10:00:00Z', 'CERRADA')).id;
    jobIds.j3 = (await mk('J3', '2025-03-05T10:00:00Z', null, 'ABIERTA')).id;
    jobIds.j4 = (await mk('J4', '2026-02-01T10:00:00Z', '2026-02-11T10:00:00Z', 'CERRADA')).id;

    for (const [i, fullName] of candidateNames.entries()) {
      candidateIds.push((await db.candidate.create({ data: { fullName, email: `${tag.toLowerCase()}.${i}@example.com` } })).id);
    }
    const stages = await db.stage.findMany({ orderBy: { order: 'asc' } });
    const s0 = stages[0]!;
    const s1 = stages[1]!;

    await db.application.create({
      data: { jobId: jobIds.j1, candidateId: candidateIds[0]!, status: 'CONTRATADO', stageId: s1.id, appliedAt: new Date('2025-01-12T10:00:00Z'), fechaIncorporacion: new Date('2025-02-15T00:00:00Z') },
    });
    await db.application.create({
      data: { jobId: jobIds.j1, candidateId: candidateIds[1]!, status: 'RECHAZADO', stageId: s0.id, appliedAt: new Date('2025-01-14T10:00:00Z') },
    });
    const a3 = await db.application.create({
      data: { jobId: jobIds.j2, candidateId: candidateIds[2]!, status: 'ACTIVO', stageId: s1.id, appliedAt: new Date('2025-01-25T10:00:00Z') },
    });
    await db.applicationEtapa.createMany({
      data: [
        { applicationId: a3.id, stageId: s0.id, enteredAt: new Date('2025-01-25T10:00:00Z') },
        { applicationId: a3.id, stageId: s1.id, enteredAt: new Date('2025-02-05T10:00:00Z') },
      ],
    });
    await db.interview.create({ data: { applicationId: a3.id, type: 'telefonica', scheduledAt: new Date('2025-02-10T09:00:00Z') } });
  });

  afterAll(async () => {
    const jobs = Object.values(jobIds).filter(Boolean);
    const apps = await db.application.findMany({ where: { jobId: { in: jobs } }, select: { id: true } });
    const appIds = apps.map((a) => a.id);
    await db.interview.deleteMany({ where: { applicationId: { in: appIds } } }).catch(() => undefined);
    await db.application.deleteMany({ where: { id: { in: appIds } } }).catch(() => undefined);
    await db.candidate.deleteMany({ where: { id: { in: candidateIds } } }).catch(() => undefined);
    await db.job.deleteMany({ where: { id: { in: jobs } } }).catch(() => undefined);
    await db.sociedad.delete({ where: { id: sociedadId } }).catch(() => undefined);
    await db.auditLog.deleteMany({ where: { entity: 'SeleccionReport', createdAt: { gte: startedAt } } }).catch(() => undefined);
    await app.close();
  });

  describe('permisos', () => {
    it('ADMIN y RRHH acceden', async () => {
      await get(rrhhToken).expect(200);
      await get(adminToken).expect(200);
    });
    it('MANAGER y EMPLEADO reciben 403; sin token 401', async () => {
      await get(managerToken).expect(403);
      await get(empleadoToken).expect(403);
      await request(http).get('/api/reports/seleccion').expect(401);
    });
    it('un year fuera de rango se rechaza con 400', async () => {
      await get(rrhhToken, '&year=1900').expect(400);
    });
  });

  describe('conteos por año y mes', () => {
    it('agrupa abiertas/cerradas por año y mes (años más recientes primero)', async () => {
      const { body } = await get(rrhhToken).expect(200);
      expect(body.totalOfertas).toBe(4);
      expect(body.porAnio.map((a: { year: number }) => a.year)).toEqual([2026, 2025]);
      const y25 = body.porAnio.find((a: { year: number }) => a.year === 2025);
      const y26 = body.porAnio.find((a: { year: number }) => a.year === 2026);
      expect(y25).toMatchObject({ abiertas: 3, cerradas: 2 });
      expect(y26).toMatchObject({ abiertas: 1, cerradas: 1 });
      const m = (y: typeof y25, n: number) => y.meses.find((x: { month: number }) => x.month === n);
      expect(m(y25, 1)).toMatchObject({ abiertas: 2, cerradas: 1 }); // J1+J2 abren, J1 cierra
      expect(m(y25, 3)).toMatchObject({ abiertas: 1, cerradas: 1 }); // J3 abre, J2 cierra
      expect(m(y25, 2)).toMatchObject({ abiertas: 0, cerradas: 0 });
      expect(y25.meses).toHaveLength(12);
      expect(m(y26, 2)).toMatchObject({ abiertas: 1, cerradas: 1 });
    });

    it('estado actual del conjunto', async () => {
      const { body } = await get(rrhhToken).expect(200);
      expect(body.estadoActual).toEqual({ BORRADOR: 0, ABIERTA: 1, PAUSADA: 0, CERRADA: 3 });
    });

    it('filtro year acota a las ofertas abiertas o cerradas ese año', async () => {
      const y25 = (await get(rrhhToken, '&year=2025').expect(200)).body;
      expect(y25.totalOfertas).toBe(3);
      expect(y25.porAnio).toHaveLength(1);
      const y26 = (await get(rrhhToken, '&year=2026').expect(200)).body;
      expect(y26.totalOfertas).toBe(1);
      expect(y26.porAnio[0]).toMatchObject({ year: 2026, abiertas: 1, cerradas: 1 });
    });

    it('filtro por proyecto inexistente devuelve estados vacíos, no error', async () => {
      const { body } = await get(rrhhToken, '&proyectoId=no-existe').expect(200);
      expect(body.totalOfertas).toBe(0);
      expect(body.porAnio).toEqual([]);
      expect(body.cierreGlobal).toEqual({ n: 0, mediaDias: null, medianaDias: null });
      expect(body.embudo.totalCandidaturas).toBe(0);
    });
  });

  describe('tiempos de cierre', () => {
    it('media y mediana por año de cierre y global (closedAt − openedAt)', async () => {
      const { body } = await get(rrhhToken).expect(200);
      const y25 = body.porAnio.find((a: { year: number }) => a.year === 2025);
      const y26 = body.porAnio.find((a: { year: number }) => a.year === 2026);
      expect(y25.cierre).toEqual({ n: 2, mediaDias: 40, medianaDias: 40 }); // (20+60)/2
      expect(y26.cierre).toEqual({ n: 1, mediaDias: 10, medianaDias: 10 });
      expect(body.cierreGlobal).toEqual({ n: 3, mediaDias: 30, medianaDias: 20 }); // 10,20,60
    });

    it('closedAt anterior a openedAt no contamina las medias', async () => {
      const bad = await db.job.create({
        data: { title: `${tag} JBad`, location: 'Madrid', level: 'mid', status: 'CERRADA', sociedadId, openedAt: new Date('2025-06-10T00:00:00Z'), closedAt: new Date('2025-06-01T00:00:00Z') },
      });
      try {
        const { body } = await get(rrhhToken).expect(200);
        expect(body.cierreGlobal.n).toBe(3);
        expect(body.ofertas.find((o: { id: string }) => o.id === bad.id).diasCierre).toBeNull();
      } finally {
        await db.job.delete({ where: { id: bad.id } });
      }
    });
  });

  describe('embudo y línea temporal', () => {
    it('embudo: etapa final, contratados, descartados y en proceso', async () => {
      const { body } = await get(rrhhToken).expect(200);
      expect(body.embudo).toMatchObject({ totalCandidaturas: 3, contratados: 1, descartados: 1, retirados: 0, enProceso: 1, sinEtapa: 0 });
      const total = body.embudo.porEtapa.reduce((s: number, e: { count: number }) => s + e.count, 0);
      expect(total).toBe(3);
    });

    it('línea temporal con hitos reales y sin nombres de candidatos', async () => {
      const { body } = await get(rrhhToken).expect(200);
      const j2 = body.ofertas.find((o: { id: string }) => o.id === jobIds.j2);
      expect(j2).toMatchObject({ postulaciones: 1, entrevistas: 1, incorporaciones: 0, diasCierre: 60, tieneHistorialEtapas: true });
      const tipos = j2.hitos.map((h: { tipo: string }) => h.tipo);
      expect(tipos).toEqual(expect.arrayContaining(['APERTURA', 'POSTULACIONES', 'ENTREVISTAS', 'ETAPA', 'CIERRE']));
      expect(j2.hitos.filter((h: { tipo: string }) => h.tipo === 'ETAPA')).toHaveLength(2);
      const fechas = j2.hitos.map((h: { fecha: string }) => h.fecha);
      expect([...fechas].sort()).toEqual(fechas); // ordenados cronológicamente

      const j1 = body.ofertas.find((o: { id: string }) => o.id === jobIds.j1);
      expect(j1).toMatchObject({ postulaciones: 2, incorporaciones: 1 });
      expect(j1.hitos.find((h: { tipo: string }) => h.tipo === 'INCORPORACIONES').fecha).toBe('2025-02-15T00:00:00.000Z');

      expect(JSON.stringify(body)).not.toContain('Nombre');
    });

    it('proceso histórico sin historial de etapas: solo hitos disponibles, nada inventado', async () => {
      const { body } = await get(rrhhToken).expect(200);
      const j1 = body.ofertas.find((o: { id: string }) => o.id === jobIds.j1);
      expect(j1.tieneHistorialEtapas).toBe(false);
      expect(j1.hitos.some((h: { tipo: string }) => h.tipo === 'ETAPA')).toBe(false);
      const j3 = body.ofertas.find((o: { id: string }) => o.id === jobIds.j3);
      expect(j3.hitos.map((h: { tipo: string }) => h.tipo)).toEqual(['APERTURA']);
      expect(j3.diasCierre).toBeNull();
    });
  });

  describe('auditoría', () => {
    it('una entrada VIEW por consulta con sus filtros', async () => {
      const where = { entity: 'SeleccionReport', action: 'VIEW', createdAt: { gte: startedAt } } as const;
      const before = await db.auditLog.count({ where });
      await get(rrhhToken, '&year=2025').expect(200);
      expect(await db.auditLog.count({ where })).toBe(before + 1);
      const last = await db.auditLog.findFirstOrThrow({ where, orderBy: { createdAt: 'desc' } });
      expect(last.after).toMatchObject({ filters: { year: 2025, sociedadId, proyectoId: null }, ofertas: 3 });
    });

    it('una consulta denegada (403) no audita', async () => {
      const where = { entity: 'SeleccionReport', createdAt: { gte: startedAt } };
      const before = await db.auditLog.count({ where });
      await get(managerToken).expect(403);
      expect(await db.auditLog.count({ where })).toBe(before);
    });
  });
});
