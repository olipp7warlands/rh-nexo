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
