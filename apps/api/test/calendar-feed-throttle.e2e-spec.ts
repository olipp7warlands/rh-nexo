import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * El feed público tiene su propio límite por IP (FEED_THROTTLE_LIMIT, ~60/min en producción). Igual
 * que auth-throttle: límite bajo propio y AppModule reimportado en caliente para que el controlador
 * lo relea. Las peticiones usan un token inexistente: no hace falta datos.
 */
describe('Feed ICS: rate limiting (integración)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    process.env.FEED_THROTTLE_LIMIT = '3';
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
    delete process.env.FEED_THROTTLE_LIMIT;
    await app.close();
  });

  it('corta con 429 tras superar el límite del feed (misma IP), también para tokens inválidos', async () => {
    const url = `/api/calendar/feed/${'a'.repeat(64)}.ics`;
    for (let i = 0; i < 3; i++) await request(http).get(url).expect(404);
    const res = await request(http).get(url).expect(429);
    expect(res.text).not.toContain('a'.repeat(64)); // el token no se refleja en el error
  });
});
