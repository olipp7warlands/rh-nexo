import { Injectable } from '@nestjs/common';
import { JobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { SeleccionReportQueryDto } from './seleccion-report.dto';

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

function median(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
}

/** media/mediana de una lista de días; `null` si no hay datos (nunca 0 inventado). */
function stats(days: number[]) {
  if (days.length === 0) return { n: 0, mediaDias: null, medianaDias: null };
  const sorted = [...days].sort((a, b) => a - b);
  return {
    n: days.length,
    mediaDias: round1(days.reduce((s, d) => s + d, 0) / days.length),
    medianaDias: round1(median(sorted)),
  };
}

export type HitoTipo = 'APERTURA' | 'POSTULACIONES' | 'ENTREVISTAS' | 'ETAPA' | 'CIERRE' | 'INCORPORACIONES';
export interface Hito {
  tipo: HitoTipo;
  label: string;
  fecha: string; // ISO; primera fecha del hito
  fechaFin: string | null; // ISO; última fecha si el hito abarca un rango
  count: number | null;
}

/**
 * Analítica agregada de Selección (procesos). NUNCA devuelve nombres de candidatos: solo conteos,
 * fechas y datos de la oferta. Alcance de ofertas: las abiertas O cerradas en `year` (si se da) que
 * cumplan sociedad/proyecto. Los meses/años usan UTC.
 */
@Injectable()
export class SeleccionReportService {
  constructor(private readonly db: PrismaService) {}

  async report(query: SeleccionReportQueryDto, viewer: AuthUser) {
    const { year, sociedadId, proyectoId } = query;
    const where: Prisma.JobWhereInput = {
      ...(sociedadId ? { sociedadId } : {}),
      ...(proyectoId ? { proyectoId } : {}),
      ...(year
        ? {
            OR: [
              { openedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
              { closedAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
            ],
          }
        : {}),
    };

    const [jobs, stages] = await this.db.$transaction([
      this.db.job.findMany({
        where,
        orderBy: [{ openedAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          title: true,
          status: true,
          openedAt: true,
          closedAt: true,
          sociedad: { select: { nombre: true } },
          proyecto: { select: { nombre: true } },
          applications: {
            select: {
              appliedAt: true,
              status: true,
              stageId: true,
              fechaIncorporacion: true,
              etapas: { select: { stageId: true, enteredAt: true } },
              interviews: { select: { scheduledAt: true } },
            },
          },
        },
      }),
      this.db.stage.findMany({ orderBy: { order: 'asc' }, select: { id: true, name: true, order: true } }),
    ]);
    const stageName = new Map(stages.map((s) => [s.id, s.name]));

    // ── Resumen por año/mes ────────────────────────────────────────────────────
    const inYear = (d: Date) => !year || d.getUTCFullYear() === year;
    type Row = { abiertas: number; cerradas: number };
    const months = new Map<number, Map<number, Row>>(); // año → mes → conteos
    const closeDays = new Map<number, number[]>(); // año de cierre → días
    const slot = (y: number, m: number) => {
      if (!months.has(y)) months.set(y, new Map());
      const ym = months.get(y)!;
      if (!ym.has(m)) ym.set(m, { abiertas: 0, cerradas: 0 });
      return ym.get(m)!;
    };
    for (const j of jobs) {
      if (inYear(j.openedAt)) slot(j.openedAt.getUTCFullYear(), j.openedAt.getUTCMonth() + 1).abiertas++;
      if (j.closedAt && inYear(j.closedAt)) {
        slot(j.closedAt.getUTCFullYear(), j.closedAt.getUTCMonth() + 1).cerradas++;
        const days = (j.closedAt.getTime() - j.openedAt.getTime()) / DAY_MS;
        // closedAt anterior a openedAt es un dato erróneo: no entra en el tiempo de cierre.
        if (days >= 0) {
          const y = j.closedAt.getUTCFullYear();
          closeDays.set(y, [...(closeDays.get(y) ?? []), days]);
        }
      }
    }
    const porAnio = [...months.keys()]
      .sort((a, b) => b - a)
      .map((y) => {
        const ym = months.get(y)!;
        const meses = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, ...(ym.get(i + 1) ?? { abiertas: 0, cerradas: 0 }) }));
        return {
          year: y,
          abiertas: meses.reduce((s, m) => s + m.abiertas, 0),
          cerradas: meses.reduce((s, m) => s + m.cerradas, 0),
          meses,
          cierre: stats(closeDays.get(y) ?? []),
        };
      });
    const allCloseDays = [...closeDays.values()].flat();

    const estadoActual: Record<JobStatus, number> = { BORRADOR: 0, ABIERTA: 0, PAUSADA: 0, CERRADA: 0 };
    for (const j of jobs) estadoActual[j.status]++;

    // ── Embudo ─────────────────────────────────────────────────────────────────
    const apps = jobs.flatMap((j) => j.applications);
    const byStage = new Map<string, number>();
    for (const a of apps) if (a.stageId) byStage.set(a.stageId, (byStage.get(a.stageId) ?? 0) + 1);
    const embudo = {
      totalCandidaturas: apps.length,
      porEtapa: stages.map((s) => ({ etapa: s.name, order: s.order, count: byStage.get(s.id) ?? 0 })),
      sinEtapa: apps.filter((a) => !a.stageId).length,
      contratados: apps.filter((a) => a.status === 'CONTRATADO').length,
      descartados: apps.filter((a) => a.status === 'RECHAZADO').length,
      retirados: apps.filter((a) => a.status === 'RETIRADO').length,
      enProceso: apps.filter((a) => a.status === 'ACTIVO').length,
    };

    // ── Línea temporal por oferta (solo hitos con dato real) ──────────────────
    const range = (dates: Date[]) => {
      const t = dates.map((d) => d.getTime());
      return { min: new Date(Math.min(...t)), max: new Date(Math.max(...t)) };
    };
    const rangeHito = (tipo: HitoTipo, label: string, dates: Date[]): Hito => {
      const r = range(dates);
      return {
        tipo,
        label,
        fecha: r.min.toISOString(),
        fechaFin: r.max.getTime() === r.min.getTime() ? null : r.max.toISOString(),
        count: dates.length,
      };
    };
    const ofertas = jobs.map((j) => {
      const hitos: Hito[] = [{ tipo: 'APERTURA', label: 'Apertura', fecha: j.openedAt.toISOString(), fechaFin: null, count: null }];
      const post = j.applications.map((a) => a.appliedAt);
      if (post.length) hitos.push(rangeHito('POSTULACIONES', 'Postulaciones', post));
      const ent = j.applications.flatMap((a) => a.interviews.map((i) => i.scheduledAt).filter((d): d is Date => !!d));
      if (ent.length) hitos.push(rangeHito('ENTREVISTAS', 'Entrevistas', ent));
      const etapas = j.applications.flatMap((a) => a.etapas);
      const perStage = new Map<string, Date[]>();
      for (const e of etapas) perStage.set(e.stageId, [...(perStage.get(e.stageId) ?? []), e.enteredAt]);
      for (const [sid, dates] of perStage) hitos.push(rangeHito('ETAPA', `Etapa: ${stageName.get(sid) ?? 'Etapa'}`, dates));
      if (j.closedAt) hitos.push({ tipo: 'CIERRE', label: 'Cierre', fecha: j.closedAt.toISOString(), fechaFin: null, count: null });
      const inc = j.applications.filter((a) => a.status === 'CONTRATADO' && a.fechaIncorporacion).map((a) => a.fechaIncorporacion as Date);
      if (inc.length) hitos.push(rangeHito('INCORPORACIONES', 'Incorporaciones', inc));
      hitos.sort((a, b) => a.fecha.localeCompare(b.fecha));
      const dias = j.closedAt ? (j.closedAt.getTime() - j.openedAt.getTime()) / DAY_MS : null;
      return {
        id: j.id,
        title: j.title,
        status: j.status,
        sociedad: j.sociedad?.nombre ?? null,
        proyecto: j.proyecto?.nombre ?? null,
        openedAt: j.openedAt.toISOString(),
        closedAt: j.closedAt?.toISOString() ?? null,
        diasCierre: dias !== null && dias >= 0 ? round1(dias) : null,
        postulaciones: post.length,
        entrevistas: ent.length,
        incorporaciones: inc.length,
        // false en procesos históricos importados: no se muestran etapas intermedias ni se infieren.
        tieneHistorialEtapas: etapas.length > 0,
        hitos,
      };
    });

    // Una entrada por consulta (no por fila), con sus filtros — igual que el histórico de candidatos.
    await this.db.auditLog.create({
      data: {
        actorId: viewer.id,
        action: 'VIEW',
        entity: 'SeleccionReport',
        after: { filters: { year: year ?? null, sociedadId: sociedadId ?? null, proyectoId: proyectoId ?? null }, ofertas: jobs.length },
      },
    });

    return {
      filters: { year: year ?? null, sociedadId: sociedadId ?? null, proyectoId: proyectoId ?? null },
      totalOfertas: jobs.length,
      porAnio,
      cierreGlobal: stats(allCloseDays),
      estadoActual,
      embudo,
      ofertas,
    };
  }
}
