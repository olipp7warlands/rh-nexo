const PROD_DB_REF = 'qkeadkgdzwzsvjvfczhv';

/**
 * Última barrera antes de conectar a la base de datos, dentro del propio proceso — no depende
 * de que ningún script wrapper (dotenv-cli, turbo, etc.) haya funcionado correctamente. Cubre
 * CUALQUIER forma de arrancar la API en watch/dev (pnpm dev, dev:local, IDE, lo que sea): si
 * DATABASE_URL resuelve al proyecto de PRODUCCIÓN de Supabase pero el proceso no es el
 * despliegue real (NODE_ENV=production, fijado explícitamente en railway.json), aborta antes
 * de que NestFactory.create() dispare la conexión de PrismaService.
 *
 * Motivo: Turborepo en modo "strict" (default en Turbo 2.x) no propaga las variables de un
 * `.env.local` de desarrollo a las tareas hijas — sin este guardián, la API puede arrancar
 * contra producción en silencio con solo un 500 más tarde como pista (ver tasks/lessons.md).
 */
export function assertNotAccidentalProduction(): void {
  const url = process.env.DATABASE_URL ?? '';
  const looksLikeProd = url.includes(PROD_DB_REF);
  const isRealProductionDeploy = process.env.NODE_ENV === 'production';

  if (looksLikeProd && !isRealProductionDeploy) {
    console.error(
      [
        '🛑 DATABASE_URL apunta al proyecto de PRODUCCIÓN de Supabase, pero este proceso NO',
        '   se está ejecutando como el despliegue real (NODE_ENV !== "production").',
        '   Esto huele a un arranque de desarrollo local que ha cargado el .env equivocado.',
        '   Abortando antes de conectar — revisa qué .env está cargando este proceso.',
      ].join('\n'),
    );
    process.exit(1);
  }
}
