import { resolve } from 'path';
import { config } from 'dotenv';
import { assertSafeTestEnv } from './test-env-guard';

// Cubre invocar `vitest` directamente (p. ej. extensión de VS Code), saltándose el script
// "test" de package.json que ya envuelve con `dotenv-cli`. `override:false` (por defecto)
// hace que esto sea idempotente y que, si ya se cargó antes, no se pise nada. Se carga primero
// `.env.test.local` (gitignored, DATABASE_URL/DIRECT_URL reales de un proyecto Supabase de
// test si lo hay) para que gane sobre los valores por defecto de `.env.test`.
config({ path: resolve(__dirname, '../../../.env.test.local') });
config({ path: resolve(__dirname, '../../../.env.test') });

// Corre SIEMPRE, sea cual sea la vía de invocación: si algo no parece un entorno de test
// aislado, aborta toda la suite antes de que cualquier spec llegue a tocar una BD o el storage.
assertSafeTestEnv(process.env);
