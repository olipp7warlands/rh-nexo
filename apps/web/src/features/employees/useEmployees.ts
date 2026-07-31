import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type EmployeeStatus = 'ACTIVO' | 'ONBOARDING' | 'AUSENTE' | 'BAJA';
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
// humanX Tanda 2: catálogos nuevos — todos "id + nombre", mismo esqueleto que LocalizacionRef.
export type TipoContratoRef = LocalizacionRef;
export type JornadaRef = LocalizacionRef;
export type ProyectoRef = LocalizacionRef;
export type RelacionEmergenciaRef = LocalizacionRef;
export type IdiomaRef = LocalizacionRef;

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  level: string;
  remote: boolean;
  startDate: string;
  status: EmployeeStatus;
  salary: number | null;
  departmentId: string | null;
  managerId: string | null;
  dni: string | null;
  address: string | null;
  iban: string | null;
  fromRecruitment?: boolean;
  candidateId?: string | null;
  department?: Department | null;
  manager?: EmployeeRef | null;
  reports?: EmployeeRef[];
  balances?: LeaveBalance[];
  // humanX: expediente
  codigo: string | null;
  vinculo: Vinculo;
  sociedadId: string | null;
  localizacionId: string;
  finPeriodoPrueba: string | null;
  vencimientoContrato: string | null;
  descripcionPuesto: string | null;
  sociedad?: SociedadRef | null;
  localizacion: LocalizacionRef;

  // humanX Tanda 2 — bloque 3 "Datos laborales" (vive en "Información profesional")
  tipoContratoId: string;
  tipoContrato: TipoContratoRef;
  jornadaId: string | null;
  jornada?: JornadaRef | null;
  horario: string | null;
  proyectoId: string | null;
  proyecto?: ProyectoRef | null;

  // humanX Tanda 2 — bloque 1 "Datos personales"
  fechaNacimiento: string | null;
  nacionalidad: string | null;

  // humanX Tanda 2 — bloque 2 "Contacto de emergencia"
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaRelacionId: string | null;
  contactoEmergenciaRelacion?: RelacionEmergenciaRef | null;
  contactoEmergenciaTelefono: string | null;

  // humanX Tanda 2 — bloque 4 "Datos administrativos" (ultra-sensible)
  numSeguridadSocial: string | null;
  situacionIRPF: string | null;

  // humanX Tanda 2 — bloque 5 "Formación"
  titulacion: string | null;
  idiomas: IdiomaRef[];
  certificaciones: string | null;
  // Solo de escritura (create/update) — el m:n se manda como lista de ids, no en el GET.
  idiomaIds?: string[];
}

export interface EmployeeFilters {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  vinculo?: Vinculo;
  paisId?: string;
  sociedadId?: string;
  proyectoId?: string;
  startDateFrom?: string;
  startDateTo?: string;
}

export function useEmployees(params: EmployeeFilters = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.status) qs.set('status', params.status);
  if (params.vinculo) qs.set('vinculo', params.vinculo);
  if (params.paisId) qs.set('paisId', params.paisId);
  if (params.sociedadId) qs.set('sociedadId', params.sociedadId);
  if (params.proyectoId) qs.set('proyectoId', params.proyectoId);
  if (params.startDateFrom) qs.set('startDateFrom', params.startDateFrom);
  if (params.startDateTo) qs.set('startDateTo', params.startDateTo);
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.get<Employee[]>(`/employees?${qs.toString()}`),
  });
}

export interface EmployeeKpis {
  plantilla: number;
  externos: number;
  total: number;
}

/** Contadores para las tarjetas de Inicio, sin traer el listado completo de empleados. */
export function useEmployeeKpis() {
  return useQuery({
    queryKey: ['employees', 'kpis'],
    queryFn: () => api.get<EmployeeKpis>('/employees/kpis'),
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: () => api.get<Employee>(`/employees/${id}`),
    enabled: !!id,
  });
}

export interface RegistroPuesto {
  id: string;
  fechaInicio: string;
  fechaFin: string | null;
  titulo: string;
  sociedad?: SociedadRef | null;
  departamento?: Department | null;
}

export interface RegistroSalarial {
  id: string;
  fecha: string;
  concepto: string;
  brutoAnual: number;
}

/** El backend ya aplica el mismo criterio (ADMIN/RRHH/propio empleado); `enabled` evita
 *  disparar la petición y comerse un 403 en silencio para quien no tiene acceso. */
export function useHistoricoPuestos(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['historico-puestos', id],
    queryFn: () => api.get<RegistroPuesto[]>(`/employees/${id}/historico-puestos`),
    enabled: enabled && !!id,
  });
}

/** El backend ya aplica el mismo criterio (ADMIN/RRHH/propio empleado); `enabled` evita
 *  disparar la petición y comerse un 403 en silencio para quien no tiene acceso. */
export function useHistoricoSalarial(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['historico-salarial', id],
    queryFn: () => api.get<RegistroSalarial[]>(`/employees/${id}/historico-salarial`),
    enabled: enabled && !!id,
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

/** Baja del empleado: estado → BAJA + apertura del proceso de Offboarding, atómico en el
 *  backend (una sola llamada, no dos mutaciones independientes). Auditado. */
export function useBajaEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fecha: string) => api.post<{ employee: Employee }>(`/employees/${id}/baja`, { fecha }),
    onSuccess: ({ employee }) => {
      qc.setQueryData(['employee', id], employee);
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['procesos'] });
    },
  });
}
