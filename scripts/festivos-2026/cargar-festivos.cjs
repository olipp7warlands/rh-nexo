// Carga los calendarios de festivos desde un JSON (ver LEEME.md).
//
// Uso:  node --env-file=<envfile> scripts/festivos-2026/cargar-festivos.cjs <calendarios.json> <refSupabaseEsperada> <dry|commit>
//
// - `dry` (siempre primero): valida y aplica en una transacción que termina en ROLLBACK; imprime el informe.
// - `commit`: igual, pero confirma. SOLO con backup verificado y confirmación expresa.
// - Aborta si la conexión no es el proyecto Supabase esperado y si falta cualquier país/localización
//   (los festivos locales se vinculan por nombre: no se crean localizaciones desde aquí).
// - Idempotente: lo ya cargado se omite. Todo entra con validado=false.
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { validate, applyFestivos, sha256 } = require('./lib.cjs');

const [file, expectedRef, mode] = process.argv.slice(2);
if (!file || !expectedRef || !['dry', 'commit'].includes(mode)) {
  console.error('Uso: cargar-festivos.cjs <calendarios.json> <refSupabaseEsperada> <dry|commit>');
  process.exit(2);
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const ref = new URL(url).username.split('.')[1] ?? '?';
console.log('destino:', new URL(url).hostname, 'ref:', ref, 'modo:', mode);
if (ref !== expectedRef) { console.error('ref inesperada, aborto'); process.exit(1); }

const raw = fs.readFileSync(file);
const fileHash = sha256(raw);
const plan = validate(JSON.parse(raw.toString('utf8')));
const printErrors = (errs) => {
  console.error(`\n${errs.length} error(es); no se carga nada:`);
  errs.slice(0, 200).forEach((e) => console.error(`  fila ${e.fila} · ${e.campo}: ${e.msg}`));
  if (errs.length > 200) console.error(`  … y ${errs.length - 200} más`);
};
console.log(`fichero: ${plan.rows.length} festivos · sha256 ${fileHash.slice(0, 16)}…`);
if (plan.errors.length) { printErrors(plan.errors); process.exit(1); }

const db = new PrismaClient({ datasources: { db: { url } } });
applyFestivos(db, plan, { commit: mode === 'commit', fileHash })
  .then((res) => {
    if (!res.ok) { printErrors(res.errors); process.exitCode = 1; return; }
    console.log(res.committed ? '\n>>> COMMIT realizado' : '\n>>> DRY-RUN: ROLLBACK realizado (no se ha guardado nada)');
    console.table({ 'Festivos nuevos': res.summary.nuevos, 'Ya existentes (omitidos)': res.summary.existentes });
    console.table(res.summary.porAmbito);
  })
  .catch((e) => { console.error('ERROR (rollback automático):', e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
