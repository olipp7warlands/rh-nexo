import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Auditoría A4 (IDOR): un candidato con candidaturas a ofertas de DOS managers distintos
 * exponía, a través de GET /candidates/:id, las candidaturas (con entrevistas/evaluaciones/
 * decisiones) de pipelines ajenos a quien preguntaba — bastaba con compartir el candidato con
 * UNA oferta propia para ver TODAS sus candidaturas. Crea un candidato + 2 applications de
 * prueba (a ofertas de e3 y de e10) y las limpia al terminar. Requiere Postgres sembrado.
 */
describe('Candidatos: aislamiento de pipelines por manager (integración, auditoría A4)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let adminToken: string;
  let managerToken: string; // carlos.soto, e3

  let candidateId: string | undefined;
  let appOwnId: string | undefined; // candidatura a la oferta de e3 (carlos)
  let appOtherId: string | undefined; // candidatura a la oferta de e10 (patricia, sin login)

  const login = (email: string) =>
    request(http).post('/api/auth/login').send({ email, password: 'nucleo123' }).then((r) => r.body.accessToken);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
    db = moduleRef.get(PrismaService);

    adminToken = await login('admin@grupo.com');
    managerToken = await login('carlos.soto@grupo.com');

    const jobOwn = await db.job.findFirst({ where: { hiringManagerId: 'e3' } });
    const jobOther = await db.job.findFirst({ where: { hiringManagerId: 'e10' } });
    if (!jobOwn || !jobOther) throw new Error('Seed inesperado: faltan ofertas de e3/e10 para el test de A4');

    const candidate = await db.candidate.create({
      data: { fullName: 'Candidato Prueba A4', email: `test.a4.${Date.now()}@example.com`, source: 'PORTAL' },
    });
    candidateId = candidate.id;

    const own = await db.application.create({ data: { jobId: jobOwn.id, candidateId: candidate.id, status: 'ACTIVO' } });
    const other = await db.application.create({ data: { jobId: jobOther.id, candidateId: candidate.id, status: 'ACTIVO' } });
    appOwnId = own.id;
    appOtherId = other.id;
  });

  afterAll(async () => {
    if (appOwnId) await db.application.delete({ where: { id: appOwnId } }).catch(() => undefined);
    if (appOtherId) await db.application.delete({ where: { id: appOtherId } }).catch(() => undefined);
    if (candidateId) await db.candidate.delete({ where: { id: candidateId } }).catch(() => undefined);
    await app.close();
  });

  it('un MANAGER solo ve, dentro del candidato, la candidatura de SU oferta — no la de otro manager', async () => {
    const res = await request(http).get(`/api/candidates/${candidateId}`).set('Authorization', `Bearer ${managerToken}`).expect(200);
    const appIds = res.body.applications.map((a: { id: string }) => a.id);
    expect(appIds).toContain(appOwnId);
    expect(appIds).not.toContain(appOtherId);
  });

  it('el mismo candidato en el listado (GET /candidates) tampoco filtra la candidatura ajena', async () => {
    const res = await request(http).get('/api/candidates').set('Authorization', `Bearer ${managerToken}`).expect(200);
    const found = res.body.find((c: { id: string }) => c.id === candidateId);
    expect(found).toBeTruthy();
    const appIds = found.applications.map((a: { id: string }) => a.id);
    expect(appIds).toContain(appOwnId);
    expect(appIds).not.toContain(appOtherId);
  });

  it('ADMIN/RRHH sí ven ambas candidaturas del candidato', async () => {
    const res = await request(http).get(`/api/candidates/${candidateId}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    const appIds = res.body.applications.map((a: { id: string }) => a.id);
    expect(appIds).toContain(appOwnId);
    expect(appIds).toContain(appOtherId);
  });
});
