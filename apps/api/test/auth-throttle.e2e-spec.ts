import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * Auditoría A1: verifica de punta a punta que /auth/login corta con 429 tras superar el
 * límite de intentos. Usa su propio límite bajo (no el relajado de .env.test) resetenado el
 * registro de módulos de Vitest e importando AppModule de nuevo en caliente, para que
 * AuthController relea AUTH_THROTTLE_LIMIT de este test y no el ya cacheado por otras specs.
 * Requiere Postgres sembrado (igual que el resto de *.e2e-spec.ts).
 */
describe('Auth: rate limiting en login (auditoría A1, integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    process.env.AUTH_THROTTLE_LIMIT = '3';
    vi.resetModules();
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.AUTH_THROTTLE_LIMIT;
  });

  it('bloquea con 429 tras superar el límite de intentos de login (misma IP)', async () => {
    for (let i = 0; i < 3; i++) {
      await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'incorrecta' });
    }
    const res = await request(http).post('/api/auth/login').send({ email: 'admin@grupo.com', password: 'incorrecta' });
    expect(res.status).toBe(429);
  });
});
