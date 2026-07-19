import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Auditoría A1: el límite de intentos de login/refresh es configurable por
 * AUTH_THROTTLE_LIMIT (5 por defecto; .env.test lo relaja a 1000 para no bloquear los
 * muchos logins de setup legítimos que hacen el resto de las specs). Unit test puro —
 * no requiere Postgres — sobre la constante que consume el guard de NestJS.
 */
describe('AUTH_THROTTLE (auditoría A1)', () => {
  const original = process.env.AUTH_THROTTLE_LIMIT;
  afterEach(() => {
    process.env.AUTH_THROTTLE_LIMIT = original;
  });

  it('usa AUTH_THROTTLE_LIMIT cuando está definido', async () => {
    process.env.AUTH_THROTTLE_LIMIT = '3';
    vi.resetModules();
    const { AUTH_THROTTLE } = await import('../src/auth/auth.controller');
    expect(AUTH_THROTTLE.default.limit).toBe(3);
  });

  it('usa 5 intentos/minuto por defecto si no está definido', async () => {
    delete process.env.AUTH_THROTTLE_LIMIT;
    vi.resetModules();
    const { AUTH_THROTTLE } = await import('../src/auth/auth.controller');
    expect(AUTH_THROTTLE.default.limit).toBe(5);
  });
});
