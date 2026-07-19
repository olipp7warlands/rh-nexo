import { Injectable } from '@nestjs/common';
import { AbsenceType, EmployeeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly db: PrismaService) {}

  async overview(departmentId?: string) {
    const empWhere: Prisma.EmployeeWhereInput = departmentId ? { departmentId } : {};
    const activeWhere: Prisma.EmployeeWhereInput = { ...empWhere, status: { not: 'BAJA' } };
    const absWhere: Prisma.AbsenceWhereInput = {
      status: 'APROBADA',
      ...(departmentId ? { employee: { departmentId } } : {}),
    };

    // Las 12 queries de este informe son de solo lectura e independientes entre sí — antes se
    // lanzaban con Promise.all() como 12 llamadas sueltas a Prisma. Bajo el pooler de Supabase
    // (pgbouncer=true) cada llamada suelta se envuelve en su propio BEGIN/DEALLOCATE ALL/COMMIT
    // (4 round-trips), así que 12 queries "sueltas" costaban 48 round-trips de red. Agrupadas
    // en una única $transaction (modo batch, no interactivo) comparten un solo BEGIN/COMMIT.
    // `groupBy` dentro del array de $transaction pierde la forma exacta de `_count`/`_sum` en el
    // tipado (limitación conocida de Prisma con la inferencia de tuplas heterogéneas) — el dato
    // en tiempo de ejecución es correcto, así que se recupera el tipo con un `as` explícito en
    // vez de perder la seguridad de tipos con `any`.
    const [departmentsRaw, byStatusRaw, byDeptRaw, costByDeptRaw, totalActive, totalAll, bajas, absAgg, absByTypeRaw, reviews, byLocationRaw, remoteCount] =
      await this.db.$transaction([
        this.db.department.findMany({ select: { id: true, name: true, color: true } }),
        this.db.employee.groupBy({ by: ['status'], _count: { _all: true }, where: empWhere, orderBy: { status: 'asc' } }),
        this.db.employee.groupBy({ by: ['departmentId'], _count: { _all: true }, where: activeWhere, orderBy: { departmentId: 'asc' } }),
        this.db.employee.groupBy({
          by: ['departmentId'],
          _sum: { salary: true },
          _count: { _all: true },
          where: activeWhere,
          orderBy: { departmentId: 'asc' },
        }),
        this.db.employee.count({ where: activeWhere }),
        this.db.employee.count({ where: empWhere }),
        this.db.employee.count({ where: { ...empWhere, status: 'BAJA' } }),
        this.db.absence.aggregate({ _sum: { days: true }, where: absWhere }),
        this.db.absence.groupBy({ by: ['type'], _sum: { days: true }, where: absWhere, orderBy: { type: 'asc' } }),
        this.db.review.findMany({ where: { rating: { not: null }, ...(departmentId ? { employee: { departmentId } } : {}) }, select: { rating: true } }),
        this.db.employee.groupBy({ by: ['location'], _count: { _all: true }, where: activeWhere, orderBy: { location: 'asc' } }),
        this.db.employee.count({ where: { ...activeWhere, remote: true } }),
      ]);
    const departments = departmentsRaw as { id: string; name: string; color: string }[];
    const byStatus = byStatusRaw as { status: EmployeeStatus; _count: { _all: number } }[];
    const byDept = byDeptRaw as { departmentId: string | null; _count: { _all: number } }[];
    const costByDept = costByDeptRaw as { departmentId: string | null; _sum: { salary: number | null }; _count: { _all: number } }[];
    const absByType = absByTypeRaw as { type: AbsenceType; _sum: { days: number | null } }[];
    const byLocation = byLocationRaw as { location: string; _count: { _all: number } }[];
    const dmap = new Map(departments.map((d) => [d.id, d]));
    const deptLabel = (id: string | null) => (id ? dmap.get(id)?.name ?? id : 'Sin asignar');
    const deptColor = (id: string | null) => (id ? dmap.get(id)?.color ?? '#9CA3AF' : '#9CA3AF');

    // Distribución de desempeño (buckets de rating)
    const buckets = { '4.5 – 5': 0, '4.0 – 4.4': 0, '3.0 – 3.9': 0, '< 3': 0 };
    for (const r of reviews) {
      const v = r.rating ?? 0;
      if (v >= 4.5) buckets['4.5 – 5']++;
      else if (v >= 4) buckets['4.0 – 4.4']++;
      else if (v >= 3) buckets['3.0 – 3.9']++;
      else buckets['< 3']++;
    }

    return {
      headcount: {
        totalActive,
        totalAll,
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
        byDept: byDept
          .map((d) => ({ name: deptLabel(d.departmentId), color: deptColor(d.departmentId), count: d._count._all }))
          .sort((a, b) => b.count - a.count),
      },
      rotation: { bajas, total: totalAll, rate: totalAll ? Math.round((bajas / totalAll) * 1000) / 10 : 0 },
      absenteeism: {
        totalDays: absAgg._sum.days ?? 0,
        byType: absByType.map((t) => ({ type: t.type, days: t._sum.days ?? 0 })).sort((a, b) => b.days - a.days),
      },
      cost: {
        byDept: costByDept
          .map((d) => ({ name: deptLabel(d.departmentId), color: deptColor(d.departmentId), total: d._sum.salary ?? 0, count: d._count._all }))
          .sort((a, b) => b.total - a.total),
        total: costByDept.reduce((s, d) => s + (d._sum.salary ?? 0), 0),
      },
      performance: { distribution: Object.entries(buckets).map(([label, count]) => ({ label, count })), rated: reviews.length },
      diversity: {
        byLocation: byLocation.map((l) => ({ location: l.location, count: l._count._all })).sort((a, b) => b.count - a.count),
        remote: remoteCount,
        onsite: totalActive - remoteCount,
      },
    };
  }

  async exportCsv(departmentId?: string): Promise<string> {
    const o = await this.overview(departmentId);
    const header = ['Departamento', 'Plantilla activa', 'Coste anual (€)'];
    const costMap = new Map(o.cost.byDept.map((d) => [d.name, d]));
    const names = new Set([...o.headcount.byDept.map((d) => d.name), ...o.cost.byDept.map((d) => d.name)]);
    const lines = [...names].map((name) => {
      const head = o.headcount.byDept.find((d) => d.name === name)?.count ?? 0;
      const cost = costMap.get(name)?.total ?? 0;
      return [name, String(head), String(cost)].join(';');
    });
    return [header.join(';'), ...lines].join('\n');
  }
}
