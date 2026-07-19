import { describe, expect, it } from 'vitest';
import { assertSecretsConfigured } from '../src/assert-secrets-configured';

const validEnv = (): NodeJS.ProcessEnv => ({
  JWT_SECRET: 'un-secreto-razonablemente-largo',
  JWT_REFRESH_SECRET: 'otro-secreto-razonablemente-largo',
});

describe('assertSecretsConfigured (auditoría A2)', () => {
  it('no lanza con secretos válidos', () => {
    expect(() => assertSecretsConfigured(validEnv())).not.toThrow();
  });

  it('lanza si JWT_SECRET falta', () => {
    const env = validEnv();
    delete env.JWT_SECRET;
    expect(() => assertSecretsConfigured(env)).toThrow(/JWT_SECRET/);
  });

  it('lanza si JWT_REFRESH_SECRET falta', () => {
    const env = validEnv();
    delete env.JWT_REFRESH_SECRET;
    expect(() => assertSecretsConfigured(env)).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('lanza si JWT_SECRET es un valor trivial/corto (p. ej. "dev-secret")', () => {
    const env = validEnv();
    env.JWT_SECRET = 'dev-secret';
    expect(() => assertSecretsConfigured(env)).toThrow(/JWT_SECRET/);
  });

  it('lanza si ambos secretos faltan, listando los dos', () => {
    expect(() => assertSecretsConfigured({})).toThrow(/JWT_SECRET, JWT_REFRESH_SECRET/);
  });
});
