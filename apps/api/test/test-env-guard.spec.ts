import { describe, expect, it } from 'vitest';
import { assertSafeTestEnv } from './test-env-guard';

const validEnv = (): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgresql://nucleo:nucleo@localhost:5432/nucleo_test?schema=public',
  DIRECT_URL: 'postgresql://nucleo:nucleo@localhost:5432/nucleo_test?schema=public',
  STORAGE_PROVIDER: '',
});

describe('assertSafeTestEnv', () => {
  it('no lanza con un entorno local válido', () => {
    expect(() => assertSafeTestEnv(validEnv())).not.toThrow();
  });

  it('acepta 127.0.0.1 como host local', () => {
    const env = validEnv();
    env.DATABASE_URL = 'postgresql://nucleo:nucleo@127.0.0.1:5432/nucleo_test';
    env.DIRECT_URL = 'postgresql://nucleo:nucleo@127.0.0.1:5432/nucleo_test';
    expect(() => assertSafeTestEnv(env)).not.toThrow();
  });

  it('lanza si DATABASE_URL apunta a un proyecto Supabase no reconocido', () => {
    const env = validEnv();
    env.DATABASE_URL =
      'postgresql://postgres.otroproyecto1234@aws-0-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true';
    expect(() => assertSafeTestEnv(env)).toThrow(/DATABASE_URL/);
  });

  it('lanza si DIRECT_URL apunta a un proyecto Supabase no reconocido', () => {
    const env = validEnv();
    env.DIRECT_URL = 'postgresql://postgres:pass@db.otroproyecto1234.supabase.co:5432/postgres';
    expect(() => assertSafeTestEnv(env)).toThrow(/DIRECT_URL/);
  });

  it('acepta el proyecto Supabase dedicado a test (humanx-test), vía pooler', () => {
    const env = validEnv();
    env.DATABASE_URL =
      'postgresql://postgres.cviovilivlvaebpcqbhj:pass@aws-0-eu-west-3.pooler.supabase.com:5432/postgres';
    env.DIRECT_URL = env.DATABASE_URL;
    expect(() => assertSafeTestEnv(env)).not.toThrow();
  });

  it('acepta el proyecto Supabase dedicado a test (humanx-test), vía conexión directa', () => {
    const env = validEnv();
    env.DIRECT_URL = 'postgresql://postgres:pass@db.cviovilivlvaebpcqbhj.supabase.co:6543/postgres';
    expect(() => assertSafeTestEnv(env)).not.toThrow();
  });

  it('bloquea el proyecto de PRODUCCIÓN aunque llegue con forma de pooler de test', () => {
    const env = validEnv();
    env.DATABASE_URL = 'postgresql://postgres.qkeadkgdzwzsvjvfczhv:pass@aws-0-eu-west-3.pooler.supabase.com:6543/postgres';
    expect(() => assertSafeTestEnv(env)).toThrow(/DATABASE_URL/);
  });

  it('bloquea el proyecto de PRODUCCIÓN por conexión directa', () => {
    const env = validEnv();
    env.DIRECT_URL = 'postgresql://postgres:pass@db.qkeadkgdzwzsvjvfczhv.supabase.co:5432/postgres';
    expect(() => assertSafeTestEnv(env)).toThrow(/DIRECT_URL/);
  });

  it('lanza si STORAGE_PROVIDER es "supabase"', () => {
    const env = validEnv();
    env.STORAGE_PROVIDER = 'supabase';
    expect(() => assertSafeTestEnv(env)).toThrow(/STORAGE_PROVIDER/);
  });

  it('lanza si DATABASE_URL falta o está vacía', () => {
    const env = validEnv();
    env.DATABASE_URL = undefined;
    expect(() => assertSafeTestEnv(env)).toThrow(/DATABASE_URL/);
  });

  it('lanza si DATABASE_URL no es una URL parseable', () => {
    const env = validEnv();
    env.DATABASE_URL = 'esto-no-es-una-url';
    expect(() => assertSafeTestEnv(env)).toThrow(/DATABASE_URL/);
  });

  it('el mensaje de error no incluye la contraseña de la conexión', () => {
    const env = validEnv();
    env.DATABASE_URL = 'postgresql://user:secreto123@evil.supabase.co:5432/postgres';
    try {
      assertSafeTestEnv(env);
      throw new Error('no debería llegar aquí');
    } catch (err) {
      expect((err as Error).message).not.toContain('secreto123');
    }
  });
});
