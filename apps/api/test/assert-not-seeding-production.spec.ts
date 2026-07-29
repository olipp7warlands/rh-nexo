import { describe, expect, it } from 'vitest';
import {
  assertNotSeedingProductionByAccident,
  PROD_DB_REF,
  SEED_ALLOW_PRODUCTION_TOKEN,
} from '../../../scripts/assert-not-seeding-production';

describe('assertNotSeedingProductionByAccident (auditoría, hallazgo bajo)', () => {
  it('no lanza si DATABASE_URL no es de producción', () => {
    expect(() =>
      assertNotSeedingProductionByAccident({ DATABASE_URL: 'postgresql://postgres.dfwwslptvumtmqrlehek:x@host:6543/postgres' }),
    ).not.toThrow();
  });

  it('lanza si DATABASE_URL es de producción y no hay excepción', () => {
    expect(() =>
      assertNotSeedingProductionByAccident({ DATABASE_URL: `postgresql://postgres.${PROD_DB_REF}:x@host:6543/postgres` }),
    ).toThrow(/PRODUCCIÓN/);
  });

  it('no lanza si es producción pero SEED_ALLOW_PRODUCTION trae el token exacto', () => {
    expect(() =>
      assertNotSeedingProductionByAccident({
        DATABASE_URL: `postgresql://postgres.${PROD_DB_REF}:x@host:6543/postgres`,
        SEED_ALLOW_PRODUCTION: SEED_ALLOW_PRODUCTION_TOKEN,
      }),
    ).not.toThrow();
  });

  it('lanza si es producción y SEED_ALLOW_PRODUCTION trae cualquier otro valor', () => {
    expect(() =>
      assertNotSeedingProductionByAccident({
        DATABASE_URL: `postgresql://postgres.${PROD_DB_REF}:x@host:6543/postgres`,
        SEED_ALLOW_PRODUCTION: 'yes',
      }),
    ).toThrow(/PRODUCCIÓN/);
  });
});
