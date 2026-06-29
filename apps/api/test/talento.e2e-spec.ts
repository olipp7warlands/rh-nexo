import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 3: onboarding (marcar tarea mueve el progreso) y desempeño (review + KR persisten).
 * Restaura los valores tocados al terminar. Requiere Postgres sembrado.
 */
describe('Talento — Onboarding + Desempeño (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let db: PrismaService;
  let token: string;

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
    token = await login('blanca.ruiz@grupo.com'); // RRHH
  });

  afterAll(async () => {
    await app.close();
  });

  it('onboarding: marcar una tarea pendiente sube el progreso (done) y persiste', async () => {
    const list = await request(http).get('/api/onboarding').set('Authorization', `Bearer ${token}`).expect(200);
    const proc = list.body.find((p: { total: number; done: number }) => p.done < p.total);
    expect(proc).toBeTruthy();
    const doneBefore = proc.done;

    const detail = await request(http).get(`/api/onboarding/${proc.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    const pending = detail.body.tasks.find((t: { done: boolean }) => !t.done);

    await request(http)
      .patch(`/api/onboarding/tasks/${pending.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ done: true })
      .expect(200);

    const after = await request(http).get('/api/onboarding').set('Authorization', `Bearer ${token}`).expect(200);
    const procAfter = after.body.find((p: { id: string }) => p.id === proc.id);
    expect(procAfter.done).toBe(doneBefore + 1);

    // restaurar
    await db.onboardingTask.update({ where: { id: pending.id }, data: { done: false, doneAt: null } });
  });

  it('desempeño: actualizar una review persiste (rating + managerDone)', async () => {
    const cycles = await request(http).get('/api/performance/cycles').set('Authorization', `Bearer ${token}`).expect(200);
    const cycleId = cycles.body[0].id;
    const detail = await request(http).get(`/api/performance/cycles/${cycleId}`).set('Authorization', `Bearer ${token}`).expect(200);
    const review = detail.body.reviews[0];
    const before = { managerDone: review.managerDone, rating: review.rating };

    await request(http)
      .patch(`/api/performance/reviews/${review.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ managerDone: true, rating: 4.7 })
      .expect(200);

    const reread = await db.review.findUnique({ where: { id: review.id } });
    expect(reread!.managerDone).toBe(true);
    expect(reread!.rating).toBe(4.7);

    await db.review.update({ where: { id: review.id }, data: before });
  });

  it('desempeño: actualizar el progreso de un Key Result persiste', async () => {
    const cycles = await request(http).get('/api/performance/cycles').set('Authorization', `Bearer ${token}`);
    const detail = await request(http).get(`/api/performance/cycles/${cycles.body[0].id}`).set('Authorization', `Bearer ${token}`);
    const kr = detail.body.objectives[0].keyResults[0];
    const before = kr.progress;

    await request(http)
      .patch(`/api/performance/key-results/${kr.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ progress: 99 })
      .expect(200);

    const reread = await db.keyResult.findUnique({ where: { id: kr.id } });
    expect(reread!.progress).toBe(99);

    await db.keyResult.update({ where: { id: kr.id }, data: { progress: before } });
  });

  it('RBAC: un EMPLEADO no puede crear ciclos (403)', async () => {
    const empToken = await login('diego.ortega@grupo.com');
    await request(http)
      .post('/api/performance/cycles')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ name: 'X', startDate: '2026-01-01', endDate: '2026-03-31' })
      .expect(403);
  });
});
