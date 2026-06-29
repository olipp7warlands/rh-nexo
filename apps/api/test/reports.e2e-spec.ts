import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Informes (integración)', () => {
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
    token = await login('blanca.ruiz@grupo.com');
  });

  afterAll(async () => {
    await app.close();
  });

  it('overview cuadra con los conteos reales de la BD', async () => {
    const res = await request(http).get('/api/reports/overview').set('Authorization', `Bearer ${token}`).expect(200);
    const activos = await db.employee.count({ where: { status: { not: 'BAJA' } } });
    const total = await db.employee.count();
    expect(res.body.headcount.totalActive).toBe(activos);
    expect(res.body.headcount.totalAll).toBe(total);
    // La suma por departamento de plantilla activa cuadra con el total activo.
    const sumDept = res.body.headcount.byDept.reduce((s: number, d: { count: number }) => s + d.count, 0);
    expect(sumDept).toBe(activos);
    // Estructura de las demás secciones.
    expect(res.body.cost.total).toBeGreaterThan(0);
    expect(Array.isArray(res.body.performance.distribution)).toBe(true);
    expect(res.body.diversity.remote + res.body.diversity.onsite).toBe(activos);
  });

  it('RBAC: un EMPLEADO no puede ver informes (403)', async () => {
    const empToken = await login('diego.ortega@grupo.com');
    await request(http).get('/api/reports/overview').set('Authorization', `Bearer ${empToken}`).expect(403);
  });
});
