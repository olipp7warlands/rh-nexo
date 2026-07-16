import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type EmployeeStatus = 'ACTIVO' | 'ONBOARDING' | 'AUSENTE' | 'BAJA';
export type ContractType = 'INDEFINIDO' | 'TEMPORAL' | 'PRACTICAS' | 'FREELANCE';
export type Vinculo = 'PLANTILLA' | 'EXTERNO';

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
export interface Pais {
  id: string;
  nombre: string;
}
export interface SociedadRef {
  id: string;
  nombre: string;
  paisId: string;
  pais: Pais;
}
export interface LocalizacionRef {
  id: string;
  nombre: string;
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
  // humanX: expediente
  codigo: string | null;
  vinculo: Vinculo;
  sociedadId: string | null;
  localizacionId: string | null;
  finPeriodoPrueba: string | null;
  vencimientoContrato: string | null;
  descripcionPuesto: string | null;
  sociedad?: SociedadRef | null;
  localizacion?: LocalizacionRef | null;
}

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  vinculo?: Vinculo;
  paisId?: string;
}

export function useEmployees(params: EmployeeFilters = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.status) qs.set('status', params.status);
  if (params.vinculo) qs.set('vinculo', params.vinculo);
  if (params.paisId) qs.set('paisId', params.paisId);
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
