// Uso: node --env-file=<envfile> run-sql.cjs <fichero.sql> <refEsperada> <commit|dry>
// Ejecuta el fichero (sin meta-comandos de psql) en UNA transaccion; imprime recuentos antes/despues
// y, en modo dry, hace ROLLBACK. Aborta si la BD no es la esperada.
const fs = require('node:fs');
const { createRequire } = require('node:module');
const req = createRequire('C:/Proyectos CLAUDE/nucleo-humanx/package.json');
const { PrismaClient } = req('@prisma/client');
const [file, expectedRef, mode] = process.argv.slice(2);
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
const u = new URL(url);
const ref = u.username.split('.')[1] ?? '?';
console.log('destino:', u.hostname + ':' + u.port, 'ref:', ref, 'modo:', mode);
if (ref !== expectedRef) { console.error('ref inesperada, aborto'); process.exit(1); }
const db = new PrismaClient({ datasources: { db: { url } } });
const T = ['User','AuditLog','Employee','Department','Candidate','Job','Application','AuditDecision','Evaluation','Interview','Proceso','ProcesoTarea','PlantillaProceso','PlantillaProcesoTarea',
  'Review','Objective','KeyResult','PerformanceCycle','PayrollRun','Payslip','PayrollItem','Document','DocumentSignature','DocumentTemplate','Anotacion','Categoria','RegistroPuesto','RegistroSalarial',
  'LeaveBalance','Absence','Holiday','Notification','Pais','Sociedad','Localizacion','TipoContrato','Jornada','RelacionEmergencia','Idioma','Proyecto','Stage'];
const counts = async (c) => {
  const o = {};
  for (const t of T) o[t] = (await c.$queryRawUnsafe(`SELECT count(*)::int n FROM "${t}"`))[0].n;
  o.demoUsersActivos = (await c.$queryRawUnsafe(`SELECT count(*)::int n FROM "User" WHERE "isActive" AND email LIKE '%@grupo.com'`))[0].n;
  o.tokensDemoActivos = (await c.$queryRawUnsafe(`SELECT count(*)::int n FROM "RefreshToken" WHERE "revokedAt" IS NULL AND "userId" IN (SELECT id FROM "User" WHERE email LIKE '%@grupo.com')`))[0].n;
  return o;
};
(async () => {
  const sql = fs.readFileSync(file, 'utf8').split('\n')
    .filter((l) => !l.trim().startsWith('\\') && !/^\s*(BEGIN|COMMIT|ROLLBACK);\s*$/.test(l) && !/^SET LOCAL/.test(l)).join('\n');
  let before, after;
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`);
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '120s'`);
      before = await counts(tx);
      await tx.$executeRawUnsafe(sql);
      after = await counts(tx);
      if (mode !== 'commit') throw new Error('__DRYRUN__');
    }, { timeout: 120000, maxWait: 20000 });
  } catch (e) {
    if (e.message !== '__DRYRUN__') { console.error('ERROR (rollback automatico):', e.message); process.exit(1); }
    console.log('>>> DRY-RUN: ROLLBACK realizado');
  }
  if (mode === 'commit') console.log('>>> COMMIT realizado');
  const rows = Object.keys(after).map((k) => ({ tabla: k, antes: before[k], despues: after[k], delta: after[k] - before[k] }));
  console.table(rows.filter((r) => r.delta !== 0 || ['demoUsersActivos','tokensDemoActivos','User','AuditLog','Pais','Sociedad','Localizacion','Holiday','Department','Employee'].includes(r.tabla)));
  const unchanged = rows.filter((r) => r.delta === 0).map((r) => r.tabla);
  console.log('sin cambios:', unchanged.join(', '));
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => db.$disconnect());
