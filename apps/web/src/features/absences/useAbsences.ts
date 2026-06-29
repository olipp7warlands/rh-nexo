import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type AbsenceType = 'VACACIONES' | 'ENFERMEDAD' | 'PERSONAL' | 'MATERNIDAD';
export type AbsenceStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

export interface Absence {
  id: string;
  employeeId: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  days: number;
  status: AbsenceStatus;
  reason: string | null;
  approverId: string | null;
  decidedAt: string | null;
  createdAt: string;
  employee?: {
    id: string;
    fullName: string;
    jobTitle?: string;
    location?: string;
    managerId?: string | null;
    department?: { name: string; color: string } | null;
  };
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  location: string | null;
}

export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  VACACIONES: 'Vacaciones',
  ENFERMEDAD: 'Enfermedad',
  PERSONAL: 'Personal',
  MATERNIDAD: 'Maternidad',
};

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['absences'] });
  qc.invalidateQueries({ queryKey: ['employee'] });
  qc.invalidateQueries({ queryKey: ['employees'] });
}

export function useAbsences(status?: AbsenceStatus) {
  const qs = status ? `?status=${status}` : '';
  return useQuery({ queryKey: ['absences', status ?? 'all'], queryFn: () => api.get<Absence[]>(`/absences${qs}`) });
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['absences', 'calendar', from, to],
    queryFn: () => api.get<Absence[]>(`/absences/calendar?from=${from}&to=${to}`),
  });
}

export function useHolidays(location?: string) {
  const qs = location ? `?location=${encodeURIComponent(location)}` : '';
  return useQuery({ queryKey: ['holidays', location ?? 'all'], queryFn: () => api.get<Holiday[]>(`/holidays${qs}`) });
}

export function useCreateAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { type: AbsenceType; startDate: string; endDate: string; reason?: string }) =>
      api.post<Absence>('/absences', data),
    onSuccess: () => invalidate(qc),
  });
}

export function useDecideAbsence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      api.patch<Absence>(`/absences/${id}/${action}`, {}),
    onSuccess: () => invalidate(qc),
  });
}
