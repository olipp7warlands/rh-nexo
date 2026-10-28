// Importación de procesos históricos de Selección (Selección II · Tanda 1).
// Lógica pura + aplicación transaccional; el CLI está en importar-procesos.cjs y los tests
// (apps/api/test/importacion-procesos.*) la importan tal cual. NUNCA imprime datos personales:
// los errores citan fila y columna, no el valor.
const crypto = require('node:crypto');

const COLUMNS = [
  'oferta_titulo', 'oferta_sociedad', 'oferta_departamento', 'oferta_proyecto', 'oferta_ubicacion', 'oferta_nivel',
  'oferta_tipo_contrato', 'oferta_remoto', 'oferta_vacantes', 'oferta_apertura', 'oferta_cierre', 'oferta_estado',
  'candidato_nombre', 'candidato_email', 'candidato_telefono', 'candidato_ubicacion', 'candidato_origen', 'candidato_linkedin',
  'postulacion_fecha', 'postulacion_estado', 'postulacion_etapa', 'incorporacion_fecha',
];
const OFERTA_COLS = COLUMNS.slice(0, 12);
const TIPOS_CONTRATO = ['INDEFINIDO', 'TEMPORAL', 'PRACTICAS', 'FREELANCE'];
const ESTADOS_OFERTA = ['ABIERTA', 'PAUSADA', 'CERRADA'];
const ORIGENES = ['PORTAL', 'REFERIDO', 'LINKEDIN', 'AGENCIA', 'OTRO'];
const ESTADOS_CANDIDATURA = ['ACTIVO', 'RECHAZADO', 'CONTRATADO', 'RETIRADO'];
const ETAPAS = ['Nuevo', 'Cribado', 'Entrevista', 'Prueba técnica', 'Oferta', 'Contratado'];
const DOMINIO_TECNICO = 'candidatos.humanx.invalid';
const EMAIL_RE = /^[^\s@;]+@[^\s@;]+\.[^\s@;]{2,}$/;

/** CSV con ';' (Excel es-ES), comillas dobles, BOM y CRLF. Devuelve [{_fila, ...columnas}]. */
function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', inQuotes = false, line = 1, rowStartLine = 1;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else { if (c === '\n') line++; field += c; }
    } else if (c === '"') inQuotes = true;
    else if (c === ';') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f.trim() !== '')) rows.push({ cells: row, fila: rowStartLine });
      row = []; line++; rowStartLine = line;
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((f) => f.trim() !== '')) rows.push({ cells: row, fila: rowStartLine }); }
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].cells.map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const o = { _fila: r.fila };
    header.forEach((h, k) => { o[h] = (r.cells[k] ?? '').trim(); });
    o._celdas = r.cells.length;
    return o;
  });
  return { header, records };
}

const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const normNombre = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Email técnico determinista (idempotente): marca «importado» + dominio reservado .invalid. */
function technicalEmail(nombre, jobKey, postulacion) {
  const h = crypto.createHash('sha256').update(`${normNombre(nombre)}|${jobKey}|${postulacion}`).digest('hex').slice(0, 12);
  return `importado+${h}@${DOMINIO_TECNICO}`;
}
const esEmailTecnico = (email) => email.toLowerCase().endsWith('@' + DOMINIO_TECNICO);

/** Validación sin base de datos. No carga nada: devuelve errores {fila, campo, msg}. */
function validate(header, records) {
  const errors = [];
  const err = (fila, campo, msg) => errors.push({ fila, campo, msg });
  const missing = COLUMNS.filter((c) => !header.includes(c));
  const extra = header.filter((c) => !COLUMNS.includes(c));
  missing.forEach((c) => err(1, c, 'Falta la columna.'));
  extra.forEach((c) => err(1, c, 'Columna desconocida.'));
  if (missing.length || extra.length) return { errors, jobs: new Map(), apps: [] };

  const jobs = new Map(); // key -> { key, fila, oferta{...}, ... }
  const apps = [];
  const seenInJob = new Map(); // key -> Set(email)

  for (const r of records) {
    const f = r._fila;
    if (r._celdas > COLUMNS.length) err(f, '(fila)', 'Tiene más celdas que columnas (¿un ";" sin entrecomillar?).');
    const req = (c, max) => {
      if (!r[c]) { err(f, c, 'Obligatorio.'); return false; }
      if (max && r[c].length > max) { err(f, c, `Máximo ${max} caracteres.`); return false; }
      return true;
    };
    const enumOf = (c, list, def) => {
      const v = r[c] || def;
      if (!list.includes(v)) { err(f, c, `Valor no válido (${list.join(', ')}).`); return null; }
      return v;
    };
    const date = (c, required) => {
      if (!r[c]) { if (required) err(f, c, 'Obligatorio.'); return null; }
      if (!isRealDate(r[c])) { err(f, c, 'Fecha no válida (AAAA-MM-DD).'); return null; }
      return r[c];
    };

    req('oferta_titulo', 200); req('oferta_sociedad', 200); req('oferta_ubicacion', 200); req('oferta_nivel', 50);
    req('candidato_nombre', 200); req('postulacion_etapa');
    if (r.oferta_departamento && r.oferta_departamento.length > 200) err(f, 'oferta_departamento', 'Máximo 200 caracteres.');
    const tipo = enumOf('oferta_tipo_contrato', TIPOS_CONTRATO, 'INDEFINIDO');
    const estadoOferta = enumOf('oferta_estado', ESTADOS_OFERTA);
    const origen = enumOf('candidato_origen', ORIGENES, 'OTRO');
    const estadoApp = enumOf('postulacion_estado', ESTADOS_CANDIDATURA);
    if (r.postulacion_etapa && !ETAPAS.includes(r.postulacion_etapa)) err(f, 'postulacion_etapa', `Etapa no válida (${ETAPAS.join(', ')}).`);
    let remoto = false;
    if (r.oferta_remoto) { if (!['SI', 'NO'].includes(r.oferta_remoto)) err(f, 'oferta_remoto', 'Valor no válido (SI, NO).'); else remoto = r.oferta_remoto === 'SI'; }
    let vacantes = 1;
    if (r.oferta_vacantes) { if (!/^\d+$/.test(r.oferta_vacantes) || Number(r.oferta_vacantes) < 1) err(f, 'oferta_vacantes', 'Entero >= 1.'); else vacantes = Number(r.oferta_vacantes); }
    const apertura = date('oferta_apertura', true);
    const cierre = date('oferta_cierre', false);
    const postulacion = date('postulacion_fecha', true);
    const incorp = date('incorporacion_fecha', false);

    if (estadoOferta === 'CERRADA' && !r.oferta_cierre) err(f, 'oferta_cierre', 'Obligatoria si la oferta está CERRADA.');
    if (estadoOferta && estadoOferta !== 'CERRADA' && r.oferta_cierre) err(f, 'oferta_cierre', 'Solo se admite en ofertas CERRADA.');
    if (apertura && cierre && cierre < apertura) err(f, 'oferta_cierre', 'No puede ser anterior a la apertura.');
    if (apertura && postulacion && postulacion < apertura) err(f, 'postulacion_fecha', 'No puede ser anterior a la apertura de la oferta.');
    if (estadoApp === 'CONTRATADO') {
      if (!r.incorporacion_fecha) err(f, 'incorporacion_fecha', 'Obligatoria si la candidatura está CONTRATADO.');
      if (r.postulacion_etapa && r.postulacion_etapa !== 'Contratado') err(f, 'postulacion_etapa', 'Un CONTRATADO debe estar en la etapa «Contratado».');
    } else if (estadoApp) {
      if (r.incorporacion_fecha) err(f, 'incorporacion_fecha', 'Solo se admite si la candidatura está CONTRATADO.');
      if (r.postulacion_etapa === 'Contratado') err(f, 'postulacion_etapa', 'La etapa «Contratado» exige estado CONTRATADO.');
    }
    if (postulacion && incorp && incorp < postulacion) err(f, 'incorporacion_fecha', 'No puede ser anterior a la postulación.');
    if (r.candidato_email && !EMAIL_RE.test(r.candidato_email)) err(f, 'candidato_email', 'Email no válido.');
    if (r.candidato_email && r.candidato_email.length > 254) err(f, 'candidato_email', 'Máximo 254 caracteres.');
    if (r.candidato_telefono && r.candidato_telefono.length > 30) err(f, 'candidato_telefono', 'Máximo 30 caracteres.');
    if (r.candidato_ubicacion && r.candidato_ubicacion.length > 200) err(f, 'candidato_ubicacion', 'Máximo 200 caracteres.');
    if (r.candidato_linkedin && r.candidato_linkedin.length > 500) err(f, 'candidato_linkedin', 'Máximo 500 caracteres.');

    if (!r.oferta_titulo || !r.oferta_sociedad || !apertura || !r.candidato_nombre || !postulacion) continue;
    const key = `${normNombre(r.oferta_titulo)}|${normNombre(r.oferta_sociedad)}|${apertura}`;
    const oferta = {
      titulo: r.oferta_titulo, sociedad: r.oferta_sociedad, departamento: r.oferta_departamento || null,
      proyecto: r.oferta_proyecto || null, ubicacion: r.oferta_ubicacion, nivel: r.oferta_nivel, tipo, remoto, vacantes,
      apertura, cierre, estado: estadoOferta,
    };
    const prev = jobs.get(key);
    if (!prev) { jobs.set(key, { key, fila: f, oferta }); }
    else {
      const campos = OFERTA_COLS.filter((c) => (r[c] || '') !== (records.find((x) => x._fila === prev.fila)[c] || ''));
      if (campos.length) err(f, campos.join(','), `Difiere de la primera fila de esta oferta (fila ${prev.fila}).`);
    }
    const emailReal = r.candidato_email && EMAIL_RE.test(r.candidato_email) ? r.candidato_email.toLowerCase() : null;
    const email = emailReal ?? technicalEmail(r.candidato_nombre, key, postulacion);
    const set = seenInJob.get(key) ?? new Set();
    if (set.has(email)) err(f, emailReal ? 'candidato_email' : 'candidato_nombre', 'Candidato repetido dentro de la misma oferta.');
    set.add(email); seenInJob.set(key, set);
    apps.push({
      fila: f, key, email, tecnico: !emailReal,
      candidato: { nombre: r.candidato_nombre, telefono: r.candidato_telefono || null, ubicacion: r.candidato_ubicacion || null, origen, linkedin: r.candidato_linkedin || null },
      postulacion, estado: estadoApp, etapa: r.postulacion_etapa, incorporacion: r.incorporacion_fecha || null,
    });
  }
  return { errors, jobs, apps };
}

class ImportAbort extends Error {}

/**
 * Aplica el plan validado en UNA transacción. commit=false => ROLLBACK (dry-run) con el mismo
 * informe. Idempotente: ofertas por (título, sociedad, apertura), candidatos por email,
 * candidaturas por (oferta, candidato). Lo existente no se modifica.
 */
async function applyImport(db, plan, { commit, fileHash = null } = {}) {
  const lookupErrors = [];
  const summary = {
    ofertas: { nuevas: 0, existentes: 0 }, candidatos: { nuevos: 0, existentes: 0, conEmailTecnico: 0 },
    candidaturas: { nuevas: 0, existentes: 0 },
  };
  try {
    await db.$transaction(async (tx) => {
      const [sociedades, departamentos, proyectos, stages] = await Promise.all([
        tx.sociedad.findMany({ select: { id: true, nombre: true } }),
        tx.department.findMany({ select: { id: true, name: true } }),
        tx.proyecto.findMany({ select: { id: true, nombre: true } }),
        tx.stage.findMany({ select: { id: true, name: true } }),
      ]);
      const by = (list, k) => new Map(list.map((x) => [x[k], x.id]));
      const soc = by(sociedades, 'nombre'), dep = by(departamentos, 'name'), proy = by(proyectos, 'nombre'), st = by(stages, 'name');
      for (const j of plan.jobs.values()) {
        if (!soc.has(j.oferta.sociedad)) lookupErrors.push({ fila: j.fila, campo: 'oferta_sociedad', msg: 'La sociedad no existe (nombre exacto).' });
        if (j.oferta.departamento && !dep.has(j.oferta.departamento)) lookupErrors.push({ fila: j.fila, campo: 'oferta_departamento', msg: 'El departamento no existe (nombre exacto).' });
        if (j.oferta.proyecto && !proy.has(j.oferta.proyecto)) lookupErrors.push({ fila: j.fila, campo: 'oferta_proyecto', msg: 'El proyecto no existe en el catálogo (créalo antes).' });
      }
      for (const a of plan.apps) if (!st.has(a.etapa)) lookupErrors.push({ fila: a.fila, campo: 'postulacion_etapa', msg: 'La etapa no existe en la base.' });
      if (lookupErrors.length) throw new ImportAbort();

      // Ofertas
      const jobIds = new Map();
      for (const j of plan.jobs.values()) {
        const o = j.oferta;
        const openedAt = new Date(o.apertura + 'T00:00:00Z');
        const existing = await tx.job.findFirst({
          where: { title: { equals: o.titulo, mode: 'insensitive' }, sociedadId: soc.get(o.sociedad), openedAt },
          select: { id: true },
        });
        if (existing) { jobIds.set(j.key, existing.id); summary.ofertas.existentes++; continue; }
        const created = await tx.job.create({
          data: {
            title: o.titulo, location: o.ubicacion, level: o.nivel, contractType: o.tipo, remote: o.remoto, openings: o.vacantes,
            status: o.estado, openedAt, closedAt: o.cierre ? new Date(o.cierre + 'T00:00:00Z') : null,
            sociedadId: soc.get(o.sociedad), departmentId: o.departamento ? dep.get(o.departamento) : null,
            proyectoId: o.proyecto ? proy.get(o.proyecto) : null,
          },
          select: { id: true },
        });
        jobIds.set(j.key, created.id); summary.ofertas.nuevas++;
      }

      // Candidatos (una consulta) y candidaturas existentes (una consulta)
      const emails = [...new Set(plan.apps.map((a) => a.email))];
      const candRows = emails.length ? await tx.candidate.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : [];
      const candByEmail = new Map(candRows.map((c) => [c.email.toLowerCase(), c.id]));
      const existingApps = jobIds.size
        ? await tx.application.findMany({ where: { jobId: { in: [...jobIds.values()] } }, select: { jobId: true, candidateId: true } })
        : [];
      const appKey = new Set(existingApps.map((a) => `${a.jobId}|${a.candidateId}`));

      for (const a of plan.apps) {
        let candId = candByEmail.get(a.email);
        if (candId) summary.candidatos.existentes++;
        else {
          const c = await tx.candidate.create({
            data: { fullName: a.candidato.nombre, email: a.email, phone: a.candidato.telefono, location: a.candidato.ubicacion, source: a.candidato.origen, linkedinUrl: a.candidato.linkedin },
            select: { id: true },
          });
          candId = c.id; candByEmail.set(a.email, candId); summary.candidatos.nuevos++;
          if (a.tecnico) summary.candidatos.conEmailTecnico++;
        }
        const jobId = jobIds.get(a.key);
        if (appKey.has(`${jobId}|${candId}`)) { summary.candidaturas.existentes++; continue; }
        await tx.application.create({
          data: {
            jobId, candidateId: candId, stageId: st.get(a.etapa), status: a.estado,
            appliedAt: new Date(a.postulacion + 'T00:00:00Z'),
            fechaIncorporacion: a.incorporacion ? new Date(a.incorporacion + 'T00:00:00Z') : null,
          },
        });
        appKey.add(`${jobId}|${candId}`); summary.candidaturas.nuevas++;
      }

      if (summary.ofertas.nuevas + summary.candidatos.nuevos + summary.candidaturas.nuevas > 0) {
        await tx.auditLog.create({
          data: { actorId: null, action: 'IMPORT', entity: 'ProcesosHistoricos', entityId: fileHash ? fileHash.slice(0, 16) : null, after: { ...summary, fichero_sha256: fileHash } },
        });
      }
      if (!commit) throw new ImportAbort('__DRYRUN__');
    }, { timeout: 300000, maxWait: 20000 });
  } catch (e) {
    if (!(e instanceof ImportAbort)) throw e;
    if (e.message !== '__DRYRUN__') return { ok: false, errors: lookupErrors, summary: null, committed: false };
    return { ok: true, errors: [], summary, committed: false };
  }
  return { ok: true, errors: [], summary, committed: true };
}

module.exports = { COLUMNS, parseCsv, validate, applyImport, technicalEmail, esEmailTecnico, DOMINIO_TECNICO, ETAPAS };
