const MIN_SECRET_LENGTH = 16;

/**
 * Auditoría de seguridad (A2): antes, `jwt.strategy.ts` caía a un secreto hardcodeado
 * (`'dev-secret'`) si `JWT_SECRET` no resolvía en runtime — con ese secreto público conocido,
 * cualquiera podría forjar un token válido (incluido rol ADMIN). Falla rápido en el arranque en
 * vez de degradar silenciosamente a un secreto débil y conocido.
 *
 * El umbral de longitud es una comprobación mínima de cordura (detecta secretos vacíos o
 * triviales tipo "secret"/"123456"), no un análisis de entropía completo. Lanza (en vez de
 * `process.exit`) para poder testearse directamente; el llamador real (`main.ts`) decide cómo
 * abortar el proceso.
 */
export function assertSecretsConfigured(env: NodeJS.ProcessEnv): void {
  const missing = ['JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((key) => {
    const value = env[key];
    return !value || value.length < MIN_SECRET_LENGTH;
  });

  if (missing.length > 0) {
    throw new Error(
      [
        `🛑 ${missing.join(', ')} no ${missing.length > 1 ? 'están definidos' : 'está definido'} o ${missing.length > 1 ? 'son' : 'es'} demasiado corto (mínimo ${MIN_SECRET_LENGTH} caracteres).`,
        '   La API no arranca sin un secreto real: firmar/verificar JWT con un valor vacío o',
        '   trivial permitiría forjar tokens válidos. Define estas variables en tu .env.',
      ].join('\n'),
    );
  }
}
