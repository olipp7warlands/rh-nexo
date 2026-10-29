import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const require = createRequire(import.meta.url);
const lib = require('../../../scripts/festivos-2026/lib.cjs');

/**
 * Script de carga de festivos contra la BD de TEST: validación del fichero, dry-run sin rastro,
 * commit (validado=false, local ↔ localización por nombre), idempotencia y aborto si falta un país o
 * una localización (o es de otro país / no tiene país). Países y localizaciones PROPIOS del test.
 */
describe('Carga de festivos (script)', () => {
  let db: PrismaService;
  const tag = `Carga${Date.now()}`;
  let paisId: string;
  let otroPaisId: string;
  const locIds: string[] = [];
  const paisNombre = `${tag} Pais`;
  const locNombre = `${tag} Ciudad`;

  const fila = (over: Record<string, unknown> = {}, ambito: Record<string, unknown> = {}) => ({
    ambito: { tipo: 'PAIS', pais: paisNombre, localizacion: null, ...ambito },
    date: '2026-01-01',
    name: `${tag} Año Nuevo`,
    aproximado: false,
    fuente: 'https://example.org/oficial',
    ...over,
  });
  const doc = (festivos: unknown[], extra: Record<string, unknown> = {}) => ({ anio: 2026, festivos, ...extra });
  const run = (d: unknown, commit: boolean) => {
    const plan = lib.validate(d);
    expect(plan.errors).toEqual([]);
    return lib.applyFestivos(db, plan, { commit, fileHash: 'abc' });
  };
  const count = () => db.holiday.count({ where: { name: { startsWith: tag } } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await moduleRef.init();
    db = moduleRef.get(PrismaService);
    paisId = (await db.pais.create({ data: { nombre: paisNombre } })).id;
    otroPaisId = (await db.pais.create({ data: { nombre: `${tag} Otro` } })).id;
    locIds.push((await db.localizacion.create({ data: { nombre: locNombre, paisId } })).id);
  });

  afterAll(async () => {
    await db.holiday.deleteMany({ where: { name: { startsWith: tag } } });
    await db.auditLog.deleteMany({ where: { action: 'IMPORT', entityId: 'calendarios-2026', after: { path: ['fileHash'], equals: 'abc' } } }).catch(() => undefined);
    await db.localizacion.deleteMany({ where: { id: { in: locIds } } });
    await db.localizacion.deleteMany({ where: { nombre: { startsWith: tag } } });
    await db.pais.deleteMany({ where: { id: { in: [paisId, otroPaisId] } } });
  });

  describe('validación del fichero', () => {
    it('acepta un fichero correcto y rechaza forma, fecha, año, fuente y duplicados con fila y campo', () => {
      expect(lib.validate(doc([fila()])).errors).toEqual([]);
      const bad = lib.validate(
        doc([
          fila({ date: '2026-02-30' }),
          fila({ date: '2027-01-01' }),
          fila({ fuente: '' }),
          fila({ name: ' ' }),
          fila({}, { tipo: 'MUNDO' }),
          fila({}, { tipo: 'LOCALIZACION', localizacion: null }),
          fila({}, { tipo: 'PAIS', localizacion: 'X' }),
          fila(),
          fila(),
        ]),
      );
      const campos = bad.errors.map((e: { fila: number; campo: string }) => `${e.fila}:${e.campo}`);
      expect(campos).toEqual(
        expect.arrayContaining(['1:date', '2:date', '3:fuente', '4:name', '5:ambito.tipo', '6:ambito.localizacion', '7:ambito.localizacion', '9:duplicado']),
      );
      expect(lib.validate({ festivos: 'no' }).errors).toHaveLength(1);
    });
  });

  describe('aplicación', () => {
    it('dry-run: informa pero no deja rastro (ni festivos ni auditoría)', async () => {
      const auditAntes = await db.auditLog.count({ where: { action: 'IMPORT', entity: 'Holiday' } });
      const res = await run(doc([fila(), fila({ date: '2026-05-15', name: `${tag} Local` }, { tipo: 'LOCALIZACION', localizacion: locNombre })]), false);
      expect(res).toMatchObject({ ok: true, committed: false, summary: { nuevos: 2, existentes: 0 } });
      expect(await count()).toBe(0);
      expect(await db.auditLog.count({ where: { action: 'IMPORT', entity: 'Holiday' } })).toBe(auditAntes);
    });

    it('commit: crea con validado=false, el país sin localización y el local con localización (sin país), aproximado y fuente', async () => {
      const d = doc([
        fila(),
        fila({ date: '2026-05-15', name: `${tag} Local`, fuente: 'https://example.org/local' }, { tipo: 'LOCALIZACION', localizacion: locNombre }),
        fila({ date: '2026-03-20', name: `${tag} Lunar`, aproximado: true }),
      ]);
      const res = await run(d, true);
      expect(res).toMatchObject({ ok: true, committed: true, summary: { nuevos: 3 } });
      const rows = await db.holiday.findMany({ where: { name: { startsWith: tag } }, orderBy: { date: 'asc' } });
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.validado === false)).toBe(true);
      const nacional = rows.find((r) => r.name.endsWith('Año Nuevo'))!;
      const local = rows.find((r) => r.name.endsWith('Local'))!;
      const lunar = rows.find((r) => r.name.endsWith('Lunar'))!;
      expect(nacional).toMatchObject({ paisId, localizacionId: null, fuente: 'https://example.org/oficial' });
      expect(local).toMatchObject({ paisId: null, localizacionId: locIds[0], fuente: 'https://example.org/local' });
      expect(lunar.aproximado).toBe(true);
      expect(await db.auditLog.findFirst({ where: { action: 'IMPORT', entity: 'Holiday', entityId: 'calendarios-2026' } })).not.toBeNull();
    });

    it('idempotente: repetir el commit no duplica y cuenta los existentes', async () => {
      const d = doc([fila(), fila({ date: '2026-05-15', name: `${tag} Local` }, { tipo: 'LOCALIZACION', localizacion: locNombre })]);
      const res = await run(d, true);
      expect(res.summary).toMatchObject({ nuevos: 0, existentes: 2 });
      expect(await count()).toBe(3);
    });

    it('un alias del fichero enlaza el nombre del calendario con la localización real', async () => {
      const d = doc([fila({ date: '2026-06-01', name: `${tag} Alias` }, { tipo: 'LOCALIZACION', localizacion: 'Nombre del calendario' })], {
        aliasLocalizaciones: { 'Nombre del calendario': locNombre },
      });
      expect((await run(d, true)).summary.nuevos).toBe(1);
    });
  });

  describe('abortos (no se escribe nada)', () => {
    const abortar = async (festivos: unknown[], mensaje: RegExp) => {
      const antes = await count();
      const res = await run(doc(festivos), true);
      expect(res.ok).toBe(false);
      expect(JSON.stringify(res.errors)).toMatch(mensaje);
      expect(await count()).toBe(antes);
    };

    it('localización inexistente: aborta aunque haya filas válidas en el mismo fichero', () =>
      abortar([fila({ date: '2026-07-01', name: `${tag} Valida` }), fila({ date: '2026-07-02', name: `${tag} Rara` }, { tipo: 'LOCALIZACION', localizacion: `${tag} No existe` })], /no existe: RRHH debe crearla/));

    it('país inexistente: aborta', () => abortar([fila({ date: '2026-07-03' }, { pais: `${tag} Atlántida` })], /no existe: créalo antes/));

    it('localización de otro país: aborta', () =>
      abortar([fila({ date: '2026-07-04' }, { tipo: 'LOCALIZACION', pais: `${tag} Otro`, localizacion: locNombre })], /pertenece a otro país/));

    it('localización sin país: aborta', async () => {
      const sinPais = await db.localizacion.create({ data: { nombre: `${tag} Sin pais` } });
      locIds.push(sinPais.id);
      await abortar([fila({ date: '2026-07-05' }, { tipo: 'LOCALIZACION', localizacion: sinPais.nombre })], /no tiene país asignado/);
    });
  });
});
