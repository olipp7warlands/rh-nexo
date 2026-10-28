import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const require = createRequire(import.meta.url);
const lib = require('../../../scripts/importacion-procesos/lib.cjs');

/**
 * Importación de procesos históricos contra la BD de TEST: dry-run sin rastro, commit,
 * idempotencia, email técnico y rechazo de catálogos inexistentes. Datos con marcador único,
 * limpiados al terminar.
 */
describe('Importación de procesos históricos (integración, BD de test)', () => {
  let db: PrismaService;
  let sociedad: string;
  let departamento: string;
  const tag = `Imp${Date.now()}`;
  const HEADER = lib.COLUMNS.join(';');
  const row = (o: Record<string, string>) => lib.COLUMNS.map((c: string) => o[c] ?? '').join(';');
  const plan = (rows: Record<string, string>[]) => {
    const { header, records } = lib.parseCsv([HEADER, ...rows.map(row)].join('\r\n'));
    const p = lib.validate(header, records);
    expect(p.errors).toEqual([]);
    return p;
  };
  const off = () => ({
    oferta_titulo: `${tag} Oferta`, oferta_sociedad: sociedad, oferta_departamento: departamento, oferta_ubicacion: 'Madrid',
    oferta_nivel: 'Senior', oferta_apertura: '2025-03-03', oferta_cierre: '2025-05-16', oferta_estado: 'CERRADA',
  });
  const rows = () => [
    { ...off(), candidato_nombre: `${tag} Contratada`, candidato_email: `${tag.toLowerCase()}.c@example.com`, candidato_ubicacion: 'Valencia',
      postulacion_fecha: '2025-03-10', postulacion_estado: 'CONTRATADO', postulacion_etapa: 'Contratado', incorporacion_fecha: '2025-06-02' },
    { ...off(), candidato_nombre: `${tag} Sin Email`, postulacion_fecha: '2025-03-12', postulacion_estado: 'RECHAZADO', postulacion_etapa: 'Entrevista' },
  ];
  const jobsOfTag = () => db.job.findMany({ where: { title: { startsWith: tag } } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    db = moduleRef.get(PrismaService);
    await db.$connect();
    sociedad = (await db.sociedad.findFirstOrThrow()).nombre;
    departamento = (await db.department.findFirstOrThrow()).name;
  });

  afterAll(async () => {
    const jobs = await jobsOfTag();
    const cands = await db.candidate.findMany({ where: { fullName: { startsWith: tag } } });
    await db.application.deleteMany({ where: { jobId: { in: jobs.map((j) => j.id) } } });
    await db.candidate.deleteMany({ where: { id: { in: cands.map((c) => c.id) } } });
    await db.job.deleteMany({ where: { id: { in: jobs.map((j) => j.id) } } });
    await db.auditLog.deleteMany({ where: { entity: 'ProcesosHistoricos', entityId: `${tag}`.slice(0, 16) } });
    await db.$disconnect();
  });

  it('dry-run: informa de lo que haría y no deja NADA en la base', async () => {
    const res = await lib.applyImport(db, plan(rows()), { commit: false, fileHash: tag.padEnd(16, '0') });
    expect(res).toMatchObject({ ok: true, committed: false });
    expect(res.summary.ofertas.nuevas).toBe(1);
    expect(res.summary.candidaturas.nuevas).toBe(2);
    expect(res.summary.candidatos.conEmailTecnico).toBe(1);
    expect(await jobsOfTag()).toHaveLength(0);
    expect(await db.candidate.count({ where: { fullName: { startsWith: tag } } })).toBe(0);
  });

  it('commit: crea oferta con fechas reales, candidaturas con postulación/incorporación y email técnico marcado', async () => {
    const res = await lib.applyImport(db, plan(rows()), { commit: true, fileHash: tag.padEnd(16, '0') });
    expect(res).toMatchObject({ ok: true, committed: true });
    const [job] = await jobsOfTag();
    expect(job).toMatchObject({ status: 'CERRADA', level: 'Senior' });
    expect(job.openedAt.toISOString()).toBe('2025-03-03T00:00:00.000Z');
    expect(job.closedAt?.toISOString()).toBe('2025-05-16T00:00:00.000Z');

    const apps = await db.application.findMany({ where: { jobId: job.id }, include: { candidate: true, stage: true } });
    expect(apps).toHaveLength(2);
    const hired = apps.find((a) => a.status === 'CONTRATADO')!;
    expect(hired.appliedAt.toISOString()).toBe('2025-03-10T00:00:00.000Z');
    expect(hired.fechaIncorporacion?.toISOString()).toBe('2025-06-02T00:00:00.000Z');
    expect(hired.stage?.name).toBe('Contratado');
    expect(hired.candidate.location).toBe('Valencia');
    const tecnico = apps.find((a) => a.status === 'RECHAZADO')!;
    expect(lib.esEmailTecnico(tecnico.candidate.email)).toBe(true);
    // importar un contratado NO crea ficha de empleado
    expect(await db.employee.count({ where: { candidateId: hired.candidateId } })).toBe(0);

    const audit = await db.auditLog.findFirst({ where: { entity: 'ProcesosHistoricos', action: 'IMPORT' }, orderBy: { createdAt: 'desc' } });
    expect(audit?.actorId).toBeNull();
    expect(JSON.stringify(audit?.after)).not.toContain(tag + ' Contratada');
  });

  it('idempotente: repetir el mismo CSV no duplica nada ni escribe auditoría', async () => {
    const before = await db.auditLog.count({ where: { entity: 'ProcesosHistoricos' } });
    const res = await lib.applyImport(db, plan(rows()), { commit: true, fileHash: tag.padEnd(16, '0') });
    expect(res.summary).toEqual({
      ofertas: { nuevas: 0, existentes: 1 },
      candidatos: { nuevos: 0, existentes: 2, conEmailTecnico: 0 },
      candidaturas: { nuevas: 0, existentes: 2 },
    });
    expect(await jobsOfTag()).toHaveLength(1);
    expect(await db.candidate.count({ where: { fullName: { startsWith: tag } } })).toBe(2);
    expect(await db.auditLog.count({ where: { entity: 'ProcesosHistoricos' } })).toBe(before);
  });

  it('catálogos inexistentes (sociedad, departamento, proyecto): ok=false, con fila y campo, y nada escrito', async () => {
    const bad = [{ ...rows()[0], oferta_titulo: `${tag} Mala`, oferta_sociedad: 'Sociedad Que No Existe', oferta_departamento: 'Dept X', oferta_proyecto: 'Proy X' }];
    const res = await lib.applyImport(db, plan(bad), { commit: true });
    expect(res.ok).toBe(false);
    expect(res.errors.map((e: { campo: string }) => e.campo).sort()).toEqual(['oferta_departamento', 'oferta_proyecto', 'oferta_sociedad']);
    expect(await db.job.count({ where: { title: `${tag} Mala` } })).toBe(0);
  });
});
