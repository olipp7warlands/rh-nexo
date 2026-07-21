import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type TipoProceso = 'ONBOARDING' | 'OFFBOARDING';
export type EstadoProceso = 'NO_INICIADO' | 'EN_CURSO' | 'COMPLETADO' | 'CANCELADO';
export type EstadoTarea = 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA' | 'BLOQUEADA' | 'CANCELADA';

export interface ProcesoTarea {
  id: string;
  label: string;
  fase: string;
  responsable: string;
  estado: EstadoTarea;
  completadaAt: string | null;
}

export interface ProcesoSummary {
  id: string;
  tipo: TipoProceso;
  nombre: string | null;
  estado: EstadoProceso;
  fechaInicio: string;
  fechaObjetivo: string | null;
  total: number;
  completadas: number;
  employee: { id: string; fullName: string; jobTitle: string; department?: { name: string; color: string } | null };
  buddy?: { id: string; fullName: string } | null;
}

export interface ProcesoDetail extends Omit<ProcesoSummary, 'total' | 'completadas'> {
  tareas: ProcesoTarea[];
}

export interface PlantillaTarea {
  id: string;
  label: string;
  fase: string;
  responsable: string;
  orden: number;
}

export interface Plantilla {
  id: string;
  nombre: string;
  tipo: TipoProceso;
  activa: boolean;
  tareas: PlantillaTarea[];
  _count?: { procesos: number };
}

export const ESTADO_PROCESO_LABEL: Record<EstadoProceso, string> = {
  NO_INICIADO: 'No iniciado',
  EN_CURSO: 'En curso',
  COMPLETADO: 'Completado',
  CANCELADO: 'Cancelado',
};

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  COMPLETADA: 'Completada',
  BLOQUEADA: 'Bloqueada',
  CANCELADA: 'Cancelada',
};

// --- Procesos ---

export function useProcesos(tipo: TipoProceso) {
  return useQuery({ queryKey: ['procesos', tipo], queryFn: () => api.get<ProcesoSummary[]>(`/procesos?tipo=${tipo}`) });
}

export function useProceso(id: string) {
  return useQuery({
    queryKey: ['procesos', 'detalle', id],
    queryFn: () => api.get<ProcesoDetail>(`/procesos/${id}`),
    enabled: !!id,
  });
}

export interface CreateProcesoInput {
  employeeId: string;
  tipo: TipoProceso;
  buddyId?: string;
  plantillaId?: string;
  nombre?: string;
  fechaInicio: string;
  fechaObjetivo?: string;
}

export function useCreateProceso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProcesoInput) => api.post<ProcesoDetail>('/procesos', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procesos'] }),
  });
}

export function useUpdateProcesoEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoProceso }) => api.patch<ProcesoDetail>(`/procesos/${id}/estado`, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procesos'] }),
  });
}

export function useUpdateTareaEstado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tareaId, estado }: { tareaId: string; estado: EstadoTarea }) => api.patch<ProcesoTarea>(`/procesos/tareas/${tareaId}`, { estado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['procesos'] }),
  });
}

// --- Plantillas (editor maestro) ---

export function usePlantillas(tipo: TipoProceso, enabled = true) {
  return useQuery({
    queryKey: ['plantillas', tipo],
    queryFn: () => api.get<Plantilla[]>(`/procesos/plantillas?tipo=${tipo}`),
    enabled,
  });
}

export function useCreatePlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; tipo: TipoProceso }) => api.post<Plantilla>('/procesos/plantillas', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}

export function useUpdatePlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; nombre?: string; activa?: boolean }) => api.patch<Plantilla>(`/procesos/plantillas/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}

export function useDuplicarPlantilla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Plantilla>(`/procesos/plantillas/${id}/duplicar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}

export function useCreatePlantillaTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plantillaId, ...data }: { plantillaId: string; label: string; fase: string; responsable: string; orden?: number }) =>
      api.post<PlantillaTarea>(`/procesos/plantillas/${plantillaId}/tareas`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}

export function useUpdatePlantillaTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tareaId, ...data }: { tareaId: string; label?: string; fase?: string; responsable?: string; orden?: number }) =>
      api.patch<PlantillaTarea>(`/procesos/plantillas/tareas/${tareaId}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}

export function useDeletePlantillaTarea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tareaId: string) => api.del(`/procesos/plantillas/tareas/${tareaId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plantillas'] }),
  });
}
