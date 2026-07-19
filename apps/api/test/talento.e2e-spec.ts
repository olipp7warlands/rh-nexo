import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Fase 3/G: procesos (marcar tarea mueve el progreso) y desempeño (review + KR persisten).
 * Restaura los valores tocados al terminar. Requiere Postgres sembrado.
 */
describe('Talento — Procesos + Desempeño (integración)', () => {
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

  it('procesos: marcar una tarea completada sube el progreso (estado) y persiste', async () => {
    const list = await request(http).get('/api/procesos?tipo=ONBOARDING').set('Authorization', `Bearer ${token}`).expect(200);
    const proc = list.body.find((p: { total: number; completadas: number }) => p.completadas < p.total);
    expect(proc).toBeTruthy();
    const completadasBefore = proc.completadas;

    const detail = await request(http).get(`/api/procesos/${proc.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    const pending = detail.body.tareas.find((t: { estado: string }) => t.estado !== 'COMPLETADA');

    await request(http)
      .patch(`/api/procesos/tareas/${pending.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ estado: 'COMPLETADA' })
      .expect(200);

    const after = await request(http).get('/api/procesos?tipo=ONBOARDING').set('Authorization', `Bearer ${token}`).expect(200);
    const procAfter = after.body.find((p: { id: string }) => p.id === proc.id);
    expect(procAfter.completadas).toBe(completadasBefore + 1);

    // restaurar
    await db.procesoTarea.update({ where: { id: pending.id }, data: { estado: 'PENDIENTE', completadaAt: null } });
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

  // Auditoría C1: /performance/cycles/:id exponía las reviews y OKRs de TODA la empresa a
  // cualquier autenticado. Ahora aplica el mismo scopeWhere que el resto del producto.
  it('desempeño: un EMPLEADO solo ve su propia evaluación y sus propios OKRs en el ciclo', async () => {
    const cycles = await request(http).get('/api/performance/cycles').set('Authorization', `Bearer ${token}`).expect(200);
    const cycleId = cycles.body[0].id;

    const empToken = await login('diego.ortega@grupo.com'); // e6
    const detail = await request(http).get(`/api/performance/cycles/${cycleId}`).set('Authorization', `Bearer ${empToken}`).expect(200);

    expect(detail.body.reviews.length).toBeGreaterThan(0);
    expect(detail.body.reviews.every((r: { employee: { id: string } }) => r.employee.id === 'e6')).toBe(true);
    expect(detail.body.objectives.every((o: { owner: { id: string } }) => o.owner.id === 'e6')).toBe(true);
  });

  it('desempeño: un MANAGER ve su equipo (no toda la empresa) en el ciclo', async () => {
    const cycles = await request(http).get('/api/performance/cycles').set('Authorization', `Bearer ${token}`).expect(200);
    const cycleId = cycles.body[0].id;

    const mgrToken = await login('carlos.soto@grupo.com'); // e3, manager de e4/e5/e6
    const detail = await request(http).get(`/api/performance/cycles/${cycleId}`).set('Authorization', `Bearer ${mgrToken}`).expect(200);

    const equipo = new Set(['e3', 'e4', 'e5', 'e6']);
    expect(detail.body.reviews.length).toBeGreaterThan(0);
    expect(detail.body.reviews.every((r: { employee: { id: string } }) => equipo.has(r.employee.id))).toBe(true);
    expect(detail.body.reviews.some((r: { employee: { id: string } }) => r.employee.id === 'e1')).toBe(false);
  });

  it('desempeño: ADMIN/RRHH siguen viendo el ciclo completo', async () => {
    const cycles = await request(http).get('/api/performance/cycles').set('Authorization', `Bearer ${token}`).expect(200);
    const cycleId = cycles.body[0].id;
    const totalReviews = await db.review.count({ where: { cycleId } });

    const detail = await request(http).get(`/api/performance/cycles/${cycleId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.reviews.length).toBe(totalReviews);
  });
});
