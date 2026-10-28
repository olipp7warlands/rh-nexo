// Importa procesos históricos de Selección desde un CSV (ver LEEME.md y plantilla-procesos.csv).
//
// Uso:  node --env-file=<envfile> scripts/importacion-procesos/importar-procesos.cjs <fichero.csv> <refSupabaseEsperada> <dry|commit>
//
// - `dry` (recomendado primero): valida, aplica en una transacción y hace ROLLBACK; imprime el informe.
// - `commit`: igual, pero confirma. Hacerlo SOLO con backup verificado y confirmación expresa.
// - Aborta si la conexión no es el proyecto Supabase esperado. Lee DIRECT_URL (sesión :5432).
// - No imprime datos personales: los errores citan fila y columna.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { parseCsv, validate, applyImport } = require('./lib.cjs');

const [file, expectedRef, mode] = process.argv.slice(2);
if (!file || !expectedRef || !['dry', 'commit'].includes(mode)) {
  console.error('Uso: importar-procesos.cjs <fichero.csv> <refSupabaseEsperada> <dry|commit>');
  process.exit(2);
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const ref = new URL(url).username.split('.')[1] ?? '?';
console.log('destino:', new URL(url).hostname, 'ref:', ref, 'modo:', mode);
if (ref !== expectedRef) { console.error('ref inesperada, aborto'); process.exit(1); }

const raw = fs.readFileSync(file);
const fileHash = crypto.createHash('sha256').update(raw).digest('hex');
const { header, records } = parseCsv(raw.toString('utf8'));
const plan = validate(header, records);
const printErrors = (errs) => {
  console.error(`\n${errs.length} error(es); no se carga nada:`);
  errs.slice(0, 200).forEach((e) => console.error(`  fila ${e.fila} · ${e.campo}: ${e.msg}`));
  if (errs.length > 200) console.error(`  … y ${errs.length - 200} más`);
};
console.log(`fichero: ${records.length} filas · sha256 ${fileHash.slice(0, 16)}…`);
if (plan.errors.length) { printErrors(plan.errors); process.exit(1); }

const db = new PrismaClient({ datasources: { db: { url } } });
applyImport(db, plan, { commit: mode === 'commit', fileHash })
  .then((res) => {
    if (!res.ok) { printErrors(res.errors); process.exitCode = 1; return; }
    console.log(res.committed ? '\n>>> COMMIT realizado' : '\n>>> DRY-RUN: ROLLBACK realizado (no se ha guardado nada)');
    console.table({
      'Ofertas nuevas / ya existentes': `${res.summary.ofertas.nuevas} / ${res.summary.ofertas.existentes}`,
      'Candidatos nuevos / ya existentes': `${res.summary.candidatos.nuevos} / ${res.summary.candidatos.existentes}`,
      '  de los nuevos, con email técnico': res.summary.candidatos.conEmailTecnico,
      'Candidaturas nuevas / ya existentes': `${res.summary.candidaturas.nuevas} / ${res.summary.candidaturas.existentes}`,
    });
  })
  .catch((e) => { console.error('ERROR (rollback automático):', e.message); process.exitCode = 1; })
  .finally(() => db.$disconnect());
