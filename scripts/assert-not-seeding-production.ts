export const PROD_DB_REF = 'qkeadkgdzwzsvjvfczhv';
export const SEED_ALLOW_PRODUCTION_TOKEN = 'si-se-lo-que-hago-sembrar-produccion';

/**
 * Auditoría (hallazgo bajo): `prisma/seed.ts` BORRA y reinserta datos con contraseñas
 * conocidas (nucleo123) — nada le impedía antes correr contra producción. Mismo PROD_DB_REF
 * que `apps/api/src/assert-not-accidental-production.ts` y `apps/api/test/test-env-guard.ts`
 * (sin módulo compartido entre `apps/api` y la raíz: `prisma/seed.ts` vive fuera de `apps/api`
 * y no puede importar de ahí sin convertirlo en un paquete propio, ver tasks/lessons.md #4).
 *
 * Lanza (en vez de `process.exit`) para poder testearse directamente, igual que
 * `assertSecretsConfigured` — el llamador real (`prisma/seed.ts`) decide cómo abortar.
 */
export function assertNotSeedingProductionByAccident(env: NodeJS.ProcessEnv): void {
  const url = env.DATABASE_URL ?? '';
  if (!url.includes(PROD_DB_REF)) return;
  if (env.SEED_ALLOW_PRODUCTION === SEED_ALLOW_PRODUCTION_TOKEN) return;

  throw new Error(
    [
      '🛑 DATABASE_URL apunta al proyecto de PRODUCCIÓN de Supabase.',
      '   El seed borra y reinserta datos con contraseñas conocidas (nucleo123) — no se ejecuta',
      '   contra producción salvo excepción explícita y consciente.',
      `   Si de verdad quieres hacerlo, define SEED_ALLOW_PRODUCTION=${SEED_ALLOW_PRODUCTION_TOKEN}`,
      '   en el entorno de ESTE comando concreto.',
    ].join('\n'),
  );
}
