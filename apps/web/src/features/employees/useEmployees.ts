import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type EmployeeStatus = 'ACTIVO' | 'ONBOARDING' | 'AUSENTE' | 'BAJA';
export type ContractType = 'INDEFINIDO' | 'TEMPORAL' | 'PRACTICAS' | 'FREELANCE';

export interface Department {
  id: string;
  name: string;
  color: string;
}
export interface EmployeeRef {
  id: string;
  fullName: string;
  jobTitle?: string;
  status?: EmployeeStatus;
}
export interface LeaveBalance {
  id: string;
  year: number;
  total: number;
  used: number;
  pending: number;
}

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  level: string;
  location: string;
  remote: boolean;
  startDate: string;
  contractType: ContractType;
  status: EmployeeStatus;
  salary: number | null;
  departmentId: string | null;
  managerId: string | null;
  dni: string | null;
  address: string | null;
  iban: string | null;
  emergency: string | null;
  birthday: string | null;
  fromRecruitment?: boolean;
  candidateId?: string | null;
  department?: Department | null;
  manager?: EmployeeRef | null;
  reports?: Employee[];
  balances?: LeaveBalance[];
}

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
}

export function useEmployees(params: EmployeeFilters = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.status) qs.set('status', params.status);
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.get<Employee[]>(`/employees?${qs.toString()}`),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get<Employee>(`/employees/${id}`),
    enabled: !!id,
  });
}

/** Alta de empleado: persiste e invalida el directorio. */
export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Employee>) => api.post<Employee>('/employees', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

/** Este hook es lo que hace que el botón "Editar" persista de verdad. */
export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Employee>) => api.patch<Employee>(`/employees/${id}`, data),
    onSuccess: (updated) => {
      qc.setQueryData(['employee', id], updated);
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/** Baja lógica del empleado (status → BAJA), auditada en el backend. */
export function useDeleteEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.del<Employee>(`/employees/${id}`),
    onSuccess: (updated) => {
      qc.setQueryData(['employee', id], updated);
      qc.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
