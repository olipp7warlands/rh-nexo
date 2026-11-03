import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface ReportsOverview {
  headcount: {
    totalActive: number;
    totalAll: number;
    byStatus: { status: string; count: number }[];
    byDept: { name: string; color: string; count: number }[];
  };
  rotation: { bajas: number; total: number; rate: number };
  absenteeism: { totalDays: number; byType: { type: string; days: number }[] };
  cost: { byDept: { name: string; color: string; total: number; count: number }[]; total: number };
  performance: { distribution: { label: string; count: number }[]; rated: number };
  diversity: { byLocation: { location: string; count: number }[]; remote: number; onsite: number };
}

export function useReportsOverview(departmentId?: string, enabled = true) {
  const qs = departmentId ? `?departmentId=${departmentId}` : '';
  return useQuery({
    queryKey: ['reports', departmentId ?? 'all'],
    queryFn: () => api.get<ReportsOverview>(`/reports/overview${qs}`),
    enabled,
  });
}

export type ProcesoStatus = 'BORRADOR' | 'ABIERTA' | 'PAUSADA' | 'CERRADA';
export interface CierreStats { n: number; mediaDias: number | null; medianaDias: number | null }
export interface Hito {
  tipo: 'APERTURA' | 'POSTULACIONES' | 'ENTREVISTAS' | 'ETAPA' | 'CIERRE' | 'INCORPORACIONES';
  label: string;
  fecha: string;
  fechaFin: string | null;
  count: number | null;
}
export interface SeleccionReport {
  filters: { year: number | null; sociedadId: string | null; proyectoId: string | null };
  totalOfertas: number;
  porAnio: { year: number; abiertas: number; cerradas: number; meses: { month: number; abiertas: number; cerradas: number }[]; cierre: CierreStats }[];
  cierreGlobal: CierreStats;
  estadoActual: Record<ProcesoStatus, number>;
  embudo: {
    totalCandidaturas: number;
    porEtapa: { etapa: string; order: number; count: number }[];
    sinEtapa: number;
    contratados: number;
    descartados: number;
    retirados: number;
    enProceso: number;
  };
  ofertas: {
    id: string;
    title: string;
    status: ProcesoStatus;
    sociedad: string | null;
    proyecto: string | null;
    openedAt: string;
    closedAt: string | null;
    diasCierre: number | null;
    postulaciones: number;
    entrevistas: number;
    incorporaciones: number;
    tieneHistorialEtapas: boolean;
    hitos: Hito[];
  }[];
}

/** Analítica de procesos de selección (ADMIN/RRHH). Cada consulta queda auditada en el servidor. */
export function useSeleccionReport(filters: { year?: number; sociedadId?: string; proyectoId?: string }, enabled = true) {
  const qs = new URLSearchParams();
  if (filters.year) qs.set('year', String(filters.year));
  if (filters.sociedadId) qs.set('sociedadId', filters.sociedadId);
  if (filters.proyectoId) qs.set('proyectoId', filters.proyectoId);
  const q = qs.toString();
  return useQuery({
    queryKey: ['reports', 'seleccion', filters.year ?? null, filters.sociedadId ?? null, filters.proyectoId ?? null],
    queryFn: () => api.get<SeleccionReport>(`/reports/seleccion${q ? `?${q}` : ''}`),
    enabled,
    // Cada refetch genera una entrada de auditoría: no refrescar en segundo plano.
    staleTime: 60_000,
  });
}
