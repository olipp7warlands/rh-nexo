const ALLOWED_DB_HOSTS = new Set(['localhost', '127.0.0.1']);

// Proyecto Supabase "humanx-test", dedicado en exclusiva a la suite e2e — separado de
// humanx-dev y de producción. Referencia de PRODUCCIÓN, bloqueada explícitamente por si
// alguna vez llegara con esta misma forma de URL (defensa en profundidad, ver también
// apps/api/src/assert-not-accidental-production.ts, que aplica el mismo criterio en runtime).
const TEST_SUPABASE_REF = 'cviovilivlvaebpcqbhj';
const PROD_SUPABASE_REF = 'qkeadkgdzwzsvjvfczhv';

function redactUrl(raw: string | undefined): string {
  if (!raw) return '(vacío)';
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}:${url.port || '?'}${url.pathname}`;
  } catch {
    return '(URL ilegible)';
  }
}

/**
 * Extrae la referencia del proyecto Supabase de una URL de conexión, en cualquiera de sus
 * dos formas: pooler (usuario "postgres.<ref>") o conexión directa (host
 * "db.<ref>.supabase.co"). El hostname del pooler NO basta para distinguir proyectos: todos
 * los proyectos de una misma región comparten el mismo host
 * (p. ej. aws-0-eu-west-3.pooler.supabase.com) y solo el usuario los diferencia.
 */
function extractSupabaseRef(url: URL): string | null {
  const fromPoolerUser = url.username.match(/^postgres\.([a-z0-9]+)$/i);
  if (fromPoolerUser) return fromPoolerUser[1];
  const fromDirectHost = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (fromDirectHost) return fromDirectHost[1];
  return null;
}

function isSafeDbUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (ALLOWED_DB_HOSTS.has(url.hostname)) return true;

  const ref = extractSupabaseRef(url);
  if (ref === PROD_SUPABASE_REF) return false;
  return ref === TEST_SUPABASE_REF;
}

/**
 * Aborta la suite si el entorno de test no parece aislado de producción.
 * Lista blanca (no bloqueo de patrones conocidos): localhost/127.0.0.1, el proyecto Supabase
 * dedicado a test (por referencia de proyecto, no por hostname — ver `extractSupabaseRef`), y
 * STORAGE_PROVIDER distinto de "supabase" se consideran seguros para tests.
 */
export function assertSafeTestEnv(env: NodeJS.ProcessEnv): void {
  const problems: string[] = [];

  if (!isSafeDbUrl(env.DATABASE_URL)) {
    problems.push(`DATABASE_URL no es un host de test permitido: ${redactUrl(env.DATABASE_URL)}`);
  }
  if (!isSafeDbUrl(env.DIRECT_URL)) {
    problems.push(`DIRECT_URL no es un host de test permitido: ${redactUrl(env.DIRECT_URL)}`);
  }
  if (env.STORAGE_PROVIDER === 'supabase') {
    problems.push('STORAGE_PROVIDER="supabase" — los tests no pueden usar Supabase Storage real.');
  }

  if (problems.length > 0) {
    throw new Error(
      [
        '🛑 Entorno de test inseguro: parece apuntar a producción. Aborto la suite.',
        ...problems.map((p) => `  - ${p}`),
        'Revisa .env.test y que ninguna variable ya exportada en la shell lo esté pisando.',
      ].join('\n'),
    );
  }
}
