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
  /** Ámbito: país (sin localización) o localización concreta (con su país). */
  pais: { id: string; nombre: string } | null;
  localizacion: { id: string; nombre: string; pais: { id: string; nombre: string } | null } | null;
  /** false = pendiente de validación por RRHH. */
  validado: boolean;
  /** true = fecha por confirmar (p. ej. festivos lunares). */
  aproximado: boolean;
  fuente: string | null;
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

export function useAbsences(status?: AbsenceStatus, employeeId?: string) {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (employeeId) qs.set('employeeId', employeeId);
  const search = qs.toString();
  return useQuery({
    queryKey: ['absences', status ?? 'all', employeeId ?? 'all'],
    queryFn: () => api.get<Absence[]>(`/absences${search ? `?${search}` : ''}`),
  });
}

export function useCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ['absences', 'calendar', from, to],
    queryFn: () => api.get<Absence[]>(`/absences/calendar?from=${from}&to=${to}`),
  });
}

/** Festivos que aplican al usuario (su localización y su país); el servidor filtra por ámbito. */
export function useHolidays() {
  return useQuery({ queryKey: ['holidays', 'mine'], queryFn: () => api.get<Holiday[]>('/holidays') });
}

/** Todos los festivos con su ámbito y estado de revisión (solo ADMIN/RRHH). */
export function useHolidaysManage() {
  return useQuery({ queryKey: ['holidays', 'manage'], queryFn: () => api.get<Holiday[]>('/holidays/manage') });
}

export function useUpdateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; validado?: boolean; aproximado?: boolean; date?: string }) =>
      api.patch<Holiday>(`/holidays/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] }),
  });
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
