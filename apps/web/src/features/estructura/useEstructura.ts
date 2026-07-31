import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface Pais {
  id: string;
  nombre: string;
}

export interface Sociedad {
  id: string;
  nombre: string;
  paisId: string;
  pais: Pais;
  _count: { empleados: number };
}

export interface Localizacion {
  id: string;
  nombre: string;
  _count: { empleados: number };
}

export function usePaises() {
  return useQuery({ queryKey: ['paises'], queryFn: () => api.get<Pais[]>('/paises'), staleTime: 10 * 60 * 1000 });
}

export function useSociedades() {
  return useQuery({ queryKey: ['sociedades'], queryFn: () => api.get<Sociedad[]>('/sociedades') });
}

export function useCreateSociedad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; paisId: string }) => api.post<Sociedad>('/sociedades', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sociedades'] }),
  });
}

export function useUpdateSociedad(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ nombre: string; paisId: string }>) => api.patch<Sociedad>(`/sociedades/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sociedades'] }),
  });
}

export function useDeleteSociedad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<Sociedad>(`/sociedades/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sociedades'] }),
  });
}

export function useLocalizaciones() {
  return useQuery({ queryKey: ['localizaciones'], queryFn: () => api.get<Localizacion[]>('/localizaciones') });
}

export function useCreateLocalizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string }) => api.post<Localizacion>('/localizaciones', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localizaciones'] }),
  });
}

export function useUpdateLocalizacion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string }) => api.patch<Localizacion>(`/localizaciones/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localizaciones'] }),
  });
}

export function useDeleteLocalizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<Localizacion>(`/localizaciones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['localizaciones'] }),
  });
}

// ─────────────── Catálogos editables (humanX Tanda 2) ───────────────
// Mismo esqueleto que Localizacion: id + nombre + _count.empleados, CRUD completo.
export interface Catalogo {
  id: string;
  nombre: string;
  _count: { empleados: number };
}

function makeCatalogHooks(resource: string, queryKey: string) {
  return {
    useList: () => useQuery({ queryKey: [queryKey], queryFn: () => api.get<Catalogo[]>(`/${resource}`) }),
    useCreate: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (data: { nombre: string }) => api.post<Catalogo>(`/${resource}`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
      });
    },
    useUpdate: (id: string) => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (data: { nombre: string }) => api.patch<Catalogo>(`/${resource}/${id}`, data),
        onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
      });
    },
    useDelete: () => {
      const qc = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => api.del<Catalogo>(`/${resource}/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
      });
    },
  };
}

const tiposContrato = makeCatalogHooks('tipos-contrato', 'tiposContrato');
export const useTiposContrato = tiposContrato.useList;
export const useCreateTipoContrato = tiposContrato.useCreate;
export const useUpdateTipoContrato = tiposContrato.useUpdate;
export const useDeleteTipoContrato = tiposContrato.useDelete;

const jornadas = makeCatalogHooks('jornadas', 'jornadas');
export const useJornadas = jornadas.useList;
export const useCreateJornada = jornadas.useCreate;
export const useUpdateJornada = jornadas.useUpdate;
export const useDeleteJornada = jornadas.useDelete;

const relacionesEmergencia = makeCatalogHooks('relaciones-emergencia', 'relacionesEmergencia');
export const useRelacionesEmergencia = relacionesEmergencia.useList;
export const useCreateRelacionEmergencia = relacionesEmergencia.useCreate;
export const useUpdateRelacionEmergencia = relacionesEmergencia.useUpdate;
export const useDeleteRelacionEmergencia = relacionesEmergencia.useDelete;

const proyectos = makeCatalogHooks('proyectos', 'proyectos');
export const useProyectos = proyectos.useList;
export const useCreateProyecto = proyectos.useCreate;
export const useUpdateProyecto = proyectos.useUpdate;
export const useDeleteProyecto = proyectos.useDelete;

const idiomas = makeCatalogHooks('idiomas', 'idiomas');
export const useIdiomas = idiomas.useList;
export const useCreateIdioma = idiomas.useCreate;
export const useUpdateIdioma = idiomas.useUpdate;
export const useDeleteIdioma = idiomas.useDelete;
