const ALLOWED_DB_HOSTS = new Set(['localhost', '127.0.0.1']);

function redactUrl(raw: string | undefined): string {
  if (!raw) return '(vacío)';
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.hostname}:${url.port || '?'}${url.pathname}`;
  } catch {
    return '(URL ilegible)';
  }
}

function isSafeDbUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return ALLOWED_DB_HOSTS.has(url.hostname);
}

/**
 * Aborta la suite si el entorno de test no parece aislado de producción.
 * Lista blanca (no bloqueo de patrones conocidos): solo localhost/127.0.0.1 y
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
