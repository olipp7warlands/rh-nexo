import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Camino feliz de la Fase 0: autenticación JWT + RBAC + regla salario/IBAN.
 * Arranca la app Nest en memoria (sin escuchar puerto) contra la BD sembrada.
 * Requiere Postgres arriba con el seed cargado (pnpm db:seed).
 */
describe('Auth + RBAC (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  const login = (email: string, password: string) =>
    request(http).post('/api/auth/login').send({ email, password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración que main.ts (prefijo + validación global).
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rechaza el acceso sin token (401)', async () => {
    await request(http).get('/api/employees').expect(401);
  });

  it('login con contraseña incorrecta (401)', async () => {
    await login('admin@grupo.com', 'incorrecta').expect(401);
  });

  it('camino feliz: login ADMIN → /me → lista de empleados con salario visible', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.role).toBe('ADMIN');

    const token = res.body.accessToken;
    const me = await request(http).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(me.body.email).toBe('admin@grupo.com');

    const emps = await request(http).get('/api/employees').set('Authorization', `Bearer ${token}`).expect(200);
    expect(emps.body.length).toBeGreaterThan(0);
    expect(emps.body.some((e: { salary: number | null }) => e.salary !== null)).toBe(true);
  });

  it('EMPLEADO: salario ajeno enmascarado, propio visible; no puede crear (403)', async () => {
    const res = await login('diego.ortega@grupo.com', 'nucleo123').expect(200);
    const token = res.body.accessToken;
    const ownId = res.body.user.employeeId;

    const emps = await request(http).get('/api/employees').set('Authorization', `Bearer ${token}`).expect(200);
    const others = emps.body.filter((e: { id: string }) => e.id !== ownId);
    const own = emps.body.find((e: { id: string }) => e.id === ownId);
    expect(others.every((e: { salary: number | null }) => e.salary === null)).toBe(true);
    expect(own.salary).not.toBeNull();

    await request(http)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'No Autorizado', email: 'no@x.com', jobTitle: 'x', level: 'x', location: 'x', startDate: '2026-01-01' })
      .expect(403);
  });

  it('refresh token emite un access válido', async () => {
    const res = await login('admin@grupo.com', 'nucleo123').expect(200);
    const refreshed = await request(http)
      .post('/api/auth/refresh')
      .send({ refreshToken: res.body.refreshToken })
      .expect(200);
    await request(http).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(200);
  });
});
