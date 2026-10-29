// Lógica pura + aplicación transaccional de la carga de festivos (ver LEEME.md).
// Contrato del fichero (JSON):
//   { "anio": 2026,
//     "aliasLocalizaciones": { "Karnataka": "Bengaluru" },        // opcional: nombre del fichero -> nombre real de la localización
//     "festivos": [ { "ambito": { "tipo": "PAIS"|"LOCALIZACION", "pais": "España", "localizacion": "Madrid"|null },
//                     "date": "2026-01-01", "name": "Año Nuevo", "aproximado": false, "fuente": "https://…", "nivel": "…", "notas": "…" } ] }
// Todo se carga con validado=false: RRHH los revisa y valida desde Configuración → Festivos.

const crypto = require('node:crypto');

const norm = (s) => String(s ?? '').trim().toLowerCase();
const isIsoDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Valida la forma del fichero (sin tocar la BD). Devuelve { errors, rows, alias, anio }. */
function validate(doc) {
  const errors = [];
  const add = (i, campo, msg) => errors.push({ fila: i === null ? '-' : i + 1, campo, msg });
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.festivos)) {
    return { errors: [{ fila: '-', campo: 'festivos', msg: 'El fichero debe tener un array "festivos".' }], rows: [], alias: {}, anio: null };
  }
  const anio = doc.anio ?? null;
  const alias = doc.aliasLocalizaciones && typeof doc.aliasLocalizaciones === 'object' ? doc.aliasLocalizaciones : {};
  const seen = new Set();
  const rows = [];
  doc.festivos.forEach((f, i) => {
    const a = f?.ambito ?? {};
    if (!['PAIS', 'LOCALIZACION'].includes(a.tipo)) add(i, 'ambito.tipo', 'Debe ser PAIS o LOCALIZACION.');
    if (!String(a.pais ?? '').trim()) add(i, 'ambito.pais', 'Obligatorio.');
    if (a.tipo === 'LOCALIZACION' && !String(a.localizacion ?? '').trim()) add(i, 'ambito.localizacion', 'Obligatorio para festivos locales.');
    if (a.tipo === 'PAIS' && a.localizacion) add(i, 'ambito.localizacion', 'Un festivo de país no lleva localización.');
    if (!isIsoDate(f?.date)) add(i, 'date', 'Fecha ISO válida (YYYY-MM-DD).');
    else if (anio && !String(f.date).startsWith(`${anio}-`)) add(i, 'date', `Fuera del año ${anio}.`);
    if (!String(f?.name ?? '').trim()) add(i, 'name', 'Obligatorio.');
    if (!String(f?.fuente ?? '').trim()) add(i, 'fuente', 'Obligatorio: todo festivo cargado cita su fuente.');
    if (typeof (f?.aproximado ?? false) !== 'boolean') add(i, 'aproximado', 'Debe ser true/false.');
    const key = [a.tipo, norm(a.pais), norm(a.localizacion), f?.date, norm(f?.name)].join('|');
    if (seen.has(key)) add(i, 'duplicado', 'Festivo repetido en el fichero (mismo ámbito, fecha y nombre).');
    seen.add(key);
    rows.push({
      i,
      tipo: a.tipo,
      pais: String(a.pais ?? '').trim(),
      localizacion: a.localizacion ? String(a.localizacion).trim() : null,
      date: f?.date,
      name: String(f?.name ?? '').trim(),
      aproximado: !!f?.aproximado,
      fuente: String(f?.fuente ?? '').trim(),
    });
  });
  return { errors, rows, alias, anio };
}

class Rollback extends Error {}

/**
 * Aplica la carga en UNA transacción. Antes de escribir resuelve países y localizaciones: si falta
 * alguna (o una localización no tiene país o es de otro país) ABORTA sin escribir nada. Idempotente:
 * lo que ya existe (mismo ámbito, fecha y nombre) se cuenta y se omite. `commit:false` hace ROLLBACK.
 */
async function applyFestivos(db, plan, { commit, fileHash }) {
  const errors = [];
  const summary = { nuevos: 0, existentes: 0, porAmbito: {} };
  try {
    await db.$transaction(
      async (tx) => {
        const paises = await tx.pais.findMany();
        const locs = await tx.localizacion.findMany();
        const paisByName = new Map(paises.map((p) => [norm(p.nombre), p]));
        const locByName = new Map(locs.map((l) => [norm(l.nombre), l]));
        const missingPais = new Set();
        const missingLoc = new Set();
        const resolved = [];

        for (const r of plan.rows) {
          const pais = paisByName.get(norm(r.pais));
          if (!pais) { missingPais.add(r.pais); continue; }
          if (r.tipo === 'PAIS') { resolved.push({ r, paisId: pais.id, localizacionId: null, label: pais.nombre }); continue; }
          const real = plan.alias[r.localizacion] ?? r.localizacion;
          const loc = locByName.get(norm(real));
          if (!loc) { missingLoc.add(real); continue; }
          if (loc.paisId !== pais.id) {
            errors.push({ fila: r.i + 1, campo: 'localizacion', msg: `La localización «${loc.nombre}» ${loc.paisId ? 'pertenece a otro país' : 'no tiene país asignado'} (se esperaba ${pais.nombre}).` });
            continue;
          }
          resolved.push({ r, paisId: null, localizacionId: loc.id, label: `${loc.nombre} (${pais.nombre})` });
        }
        for (const p of missingPais) errors.push({ fila: '-', campo: 'pais', msg: `El país «${p}» no existe: créalo antes de cargar.` });
        for (const l of missingLoc) errors.push({ fila: '-', campo: 'localizacion', msg: `La localización «${l}» no existe: RRHH debe crearla (con su país) antes de cargar.` });
        if (errors.length) throw new Rollback();

        for (const x of resolved) {
          const where = { date: new Date(x.r.date), name: x.r.name, paisId: x.paisId, localizacionId: x.localizacionId };
          const exists = await tx.holiday.findFirst({ where, select: { id: true } });
          summary.porAmbito[x.label] ??= { nuevos: 0, existentes: 0 };
          if (exists) { summary.existentes++; summary.porAmbito[x.label].existentes++; continue; }
          await tx.holiday.create({ data: { ...where, aproximado: x.r.aproximado, fuente: x.r.fuente, validado: false } });
          summary.nuevos++;
          summary.porAmbito[x.label].nuevos++;
        }

        await tx.auditLog.create({
          data: {
            action: 'IMPORT',
            entity: 'Holiday',
            entityId: `calendarios-${plan.anio ?? 'x'}`,
            after: { nuevos: summary.nuevos, existentes: summary.existentes, fileHash: fileHash ?? null },
          },
        });
        if (!commit) throw new Rollback();
      },
      { timeout: 60000 },
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, committed: !!commit, summary };
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

module.exports = { validate, applyFestivos, sha256 };
