// Guarda estructural (no un recordatorio, ver tasks/lessons.md #14): aborta cualquier comando
// db:dev:* / dev:local si .env.local no apunta de forma inequívoca al proyecto Supabase de
// DESARROLLO. Existe porque turbo, en modo "strict" (default en Turbo 2.x), NO propaga las
// variables de entorno del proceso padre a las tareas hijas — sin este guardián, `dev:local`
// puede arrancar contra el `.env` real (producción) en silencio, sin ningún error visible hasta
// que una query falla. Se ejecuta como PRIMER paso de cada script, en un proceso separado que
// carga `.env.local` por su cuenta (no depende de que el wrapper de turno lo haya cargado ya).
const fs = require('fs');
const path = require('path');

const PROD_REF = 'qkeadkgdzwzsvjvfczhv';
const DEV_REF = 'dfwwslptvumtmqrlehek';

function loadEnvLocal() {
  const file = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(file)) {
    console.error(`🛑 No existe ${file}. Créalo antes de correr comandos db:dev:*/dev:local.`);
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnvLocal();
const url = env.DATABASE_URL || '';

if (url.includes(PROD_REF)) {
  console.error(`🛑 .env.local apunta a PRODUCCIÓN (proyecto ${PROD_REF}). Abortando — revisa .env.local.`);
  process.exit(1);
}
if (!url.includes(DEV_REF) && !url.includes('localhost') && !url.includes('127.0.0.1')) {
  console.error('🛑 DATABASE_URL de .env.local no parece un host de desarrollo conocido. Abortando por seguridad.');
  process.exit(1);
}

console.log(`✅ .env.local apunta al proyecto de desarrollo (${url.includes(DEV_REF) ? DEV_REF : 'local'}).`);
