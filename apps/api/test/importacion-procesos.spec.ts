import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const lib = require('../../../scripts/importacion-procesos/lib.cjs');

const HEADER = lib.COLUMNS.join(';');
const row = (o: Record<string, string>) =>
  lib.COLUMNS.map((c: string) => o[c] ?? '').join(';');
const base = {
  oferta_titulo: 'Diseñador/a', oferta_sociedad: 'Colibri Live SL', oferta_ubicacion: 'Madrid', oferta_nivel: 'Senior',
  oferta_apertura: '2025-03-03', oferta_estado: 'ABIERTA', candidato_nombre: 'Ana Prueba', candidato_email: 'ana@example.com',
  postulacion_fecha: '2025-03-10', postulacion_estado: 'ACTIVO', postulacion_etapa: 'Entrevista',
};
const run = (rows: Record<string, string>[]) => {
  const { header, records } = lib.parseCsv([HEADER, ...rows.map(row)].join('\r\n'));
  return lib.validate(header, records);
};

describe('Importación de procesos históricos: parser y validación (unit)', () => {
  it('la plantilla del repo es válida tal cual (4 filas, 2 ofertas) y no contiene datos reales', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '../../../scripts/importacion-procesos/plantilla-procesos.csv'), 'utf8');
    const { header, records } = lib.parseCsv(text);
    expect(header).toEqual(lib.COLUMNS);
    const plan = lib.validate(header, records);
    expect(plan.errors).toEqual([]);
    expect(plan.apps).toHaveLength(4);
    expect(plan.jobs.size).toBe(2);
    expect(records.every((r: Record<string, string>) => !r.candidato_email || r.candidato_email.endsWith('@example.com'))).toBe(true);
  });

  it('parsea BOM, CRLF y campos entrecomillados con ";" y saltos de línea', () => {
    const csv = `﻿a;b;c\r\n1;"x;y";"l1\nl2"\r\n\r\n2;3;4\r\n`;
    const { header, records } = lib.parseCsv(csv);
    expect(header).toEqual(['a', 'b', 'c']);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ a: '1', b: 'x;y', c: 'l1\nl2', _fila: 2 });
  });

  it('una fila mínima válida produce una oferta y una candidatura', () => {
    const plan = run([base]);
    expect(plan.errors).toEqual([]);
    expect(plan.jobs.size).toBe(1);
    expect(plan.apps[0]).toMatchObject({ email: 'ana@example.com', tecnico: false });
  });

  it('reglas de fechas: cierre >= apertura, cierre solo en CERRADA y obligatorio en CERRADA, postulación >= apertura', () => {
    const campos = (rows: Record<string, string>[]) => run(rows).errors.map((e: { campo: string }) => e.campo);
    expect(campos([{ ...base, oferta_estado: 'CERRADA' }])).toContain('oferta_cierre');
    expect(campos([{ ...base, oferta_cierre: '2025-04-01' }])).toContain('oferta_cierre');
    expect(campos([{ ...base, oferta_estado: 'CERRADA', oferta_cierre: '2025-03-02' }])).toContain('oferta_cierre');
    expect(run([{ ...base, oferta_estado: 'CERRADA', oferta_cierre: '2025-03-03' }]).errors).toEqual([]);
    expect(campos([{ ...base, postulacion_fecha: '2025-03-02' }])).toContain('postulacion_fecha');
    expect(campos([{ ...base, oferta_apertura: '2025-02-30' }])).toContain('oferta_apertura');
  });

  it('CONTRATADO exige etapa Contratado e incorporación >= postulación; el resto no admite incorporación', () => {
    const ok = { ...base, postulacion_estado: 'CONTRATADO', postulacion_etapa: 'Contratado', incorporacion_fecha: '2025-06-02' };
    expect(run([ok]).errors).toEqual([]);
    const campos = (o: Record<string, string>) => run([o]).errors.map((e: { campo: string }) => e.campo);
    expect(campos({ ...ok, incorporacion_fecha: '' })).toContain('incorporacion_fecha');
    expect(campos({ ...ok, incorporacion_fecha: '2025-03-01' })).toContain('incorporacion_fecha');
    expect(campos({ ...ok, postulacion_etapa: 'Oferta' })).toContain('postulacion_etapa');
    expect(campos({ ...base, incorporacion_fecha: '2025-06-02' })).toContain('incorporacion_fecha');
    expect(campos({ ...base, postulacion_etapa: 'Contratado' })).toContain('postulacion_etapa');
  });

  it('valores fuera de catálogo, columnas desconocidas/ausentes y filas de la misma oferta incoherentes se rechazan', () => {
    const campos = (rows: Record<string, string>[]) => run(rows).errors.map((e: { campo: string }) => e.campo);
    expect(campos([{ ...base, postulacion_etapa: 'Inventada' }])).toContain('postulacion_etapa');
    expect(campos([{ ...base, oferta_tipo_contrato: 'FIJO' }])).toContain('oferta_tipo_contrato');
    expect(campos([{ ...base, oferta_vacantes: '0' }])).toContain('oferta_vacantes');
    expect(campos([{ ...base, candidato_email: 'no-es-email' }])).toContain('candidato_email');
    // misma oferta (título+sociedad+apertura) con otra ubicación en la segunda fila
    const dos = run([base, { ...base, candidato_nombre: 'Otro', candidato_email: 'otro@example.com', oferta_ubicacion: 'Dubái' }]);
    expect(dos.errors.some((e: { campo: string }) => e.campo.includes('oferta_ubicacion'))).toBe(true);
    // cabecera incorrecta
    const bad = lib.parseCsv('oferta_titulo;otra\r\nx;y');
    expect(lib.validate(bad.header, bad.records).errors.length).toBeGreaterThan(0);
  });

  it('candidato repetido dentro de la misma oferta = error; el mismo email en ofertas distintas es válido', () => {
    expect(run([base, { ...base, candidato_nombre: 'Ana Otra' }]).errors.map((e: { campo: string }) => e.campo)).toContain('candidato_email');
    const dos = run([base, { ...base, oferta_titulo: 'Otra oferta' }]);
    expect(dos.errors).toEqual([]);
    expect(dos.jobs.size).toBe(2);
  });

  it('email técnico: determinista, único por persona/oferta/fecha, dominio .invalid reconocible', () => {
    const a = lib.technicalEmail('Ana Prueba', 'k1', '2025-03-10');
    expect(a).toBe(lib.technicalEmail('  ANA   prueba ', 'k1', '2025-03-10'));
    expect(a).not.toBe(lib.technicalEmail('Ana Prueba', 'k2', '2025-03-10'));
    expect(a).toMatch(/^importado\+[0-9a-f]{12}@candidatos\.humanx\.invalid$/);
    expect(lib.esEmailTecnico(a)).toBe(true);
    expect(lib.esEmailTecnico('ana@example.com')).toBe(false);
    const plan = run([{ ...base, candidato_email: '' }]);
    expect(plan.apps[0].tecnico).toBe(true);
    expect(lib.esEmailTecnico(plan.apps[0].email)).toBe(true);
  });

  it('los mensajes de error no incluyen datos personales', () => {
    const errs = run([{ ...base, candidato_nombre: 'Persona Secreta', candidato_email: 'secreto@privado.es', postulacion_fecha: 'ayer' }]).errors;
    expect(JSON.stringify(errs)).not.toMatch(/Secreta|secreto@/);
  });

  it('acepta las fuentes nuevas, el detalle de fuente y los campos de descripción de la oferta', () => {
    const plan = run([
      {
        ...base,
        candidato_origen: 'UNIVERSIDAD', candidato_fuente_detalle: 'UPM',
        oferta_objetivo: 'Objetivo', oferta_funciones: 'Funciones', oferta_req_educacion: 'Grado',
        oferta_req_experiencia: '5 años', oferta_se_valorara: 'Inglés',
      },
    ]);
    expect(plan.errors).toEqual([]);
    expect(plan.apps[0].candidato).toMatchObject({ origen: 'UNIVERSIDAD', fuenteDetalle: 'UPM' });
    expect([...plan.jobs.values()][0].oferta).toMatchObject({
      objetivo: 'Objetivo', funciones: 'Funciones', reqEducacion: 'Grado', reqExperiencia: '5 años', seValorara: 'Inglés',
    });
    for (const origen of ['STRATOS', 'IMPULSYN', 'UNIVERSIDAD', 'INFOJOBS', 'INDEED', 'WEB_EMPRESA']) {
      expect(run([{ ...base, candidato_origen: origen }]).errors).toEqual([]);
    }
  });

  it('rechaza una fuente desconocida, un detalle > 200 y un campo de descripción > 5000', () => {
    const campos = (o: Record<string, string>) => run([{ ...base, ...o }]).errors.map((e: { campo: string }) => e.campo);
    expect(campos({ candidato_origen: 'TWITTER' })).toContain('candidato_origen');
    expect(campos({ candidato_fuente_detalle: 'a'.repeat(201) })).toContain('candidato_fuente_detalle');
    expect(campos({ oferta_funciones: 'a'.repeat(5001) })).toContain('oferta_funciones');
  });

  it('dos filas de la misma oferta con descripciones distintas se rechazan (los campos oferta_* deben coincidir)', () => {
    const errs = run([
      { ...base, oferta_funciones: 'A' },
      { ...base, candidato_nombre: 'Otra Persona', candidato_email: 'otra@example.com', oferta_funciones: 'B' },
    ]).errors;
    expect(errs.some((e: { campo: string }) => e.campo.includes('oferta_funciones'))).toBe(true);
  });
});
