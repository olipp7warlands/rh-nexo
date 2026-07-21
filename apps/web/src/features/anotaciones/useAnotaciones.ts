import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type EstadoAnotacion = 'PENDIENTE' | 'HECHA';

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  _count: { anotaciones: number };
}

export interface Anotacion {
  id: string;
  empleadoId: string;
  categoriaId: string | null;
  texto: string;
  fecha: string;
  estado: EstadoAnotacion;
  hechaAt: string | null;
  createdAt: string;
  empleado: { id: string; fullName: string; jobTitle: string; sociedad?: { nombre: string } | null };
  categoria: Categoria | null;
  autor: { id: string; email: string; employee?: { fullName: string } | null };
}

export interface AnotacionFilters {
  empleadoId?: string;
  categoriaId?: string;
  estado?: EstadoAnotacion;
  desde?: string;
  hasta?: string;
}

export function useCategorias(enabled = true) {
  return useQuery({ queryKey: ['categorias'], queryFn: () => api.get<Categoria[]>('/categorias'), enabled });
}

export function useCreateCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombre: string; color: string; orden?: number }) => api.post<Categoria>('/categorias', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias'] }),
  });
}

export function useUpdateCategoria(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ nombre: string; color: string; orden: number }>) => api.patch<Categoria>(`/categorias/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias'] }),
  });
}

export function useDeleteCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<Categoria>(`/categorias/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categorias'] });
      qc.invalidateQueries({ queryKey: ['anotaciones'] });
    },
  });
}

export function useAnotaciones(filters: AnotacionFilters = {}, enabled = true) {
  const qs = new URLSearchParams();
  if (filters.empleadoId) qs.set('empleadoId', filters.empleadoId);
  if (filters.categoriaId) qs.set('categoriaId', filters.categoriaId);
  if (filters.estado) qs.set('estado', filters.estado);
  if (filters.desde) qs.set('desde', filters.desde);
  if (filters.hasta) qs.set('hasta', filters.hasta);
  return useQuery({
    queryKey: ['anotaciones', filters],
    queryFn: () => api.get<Anotacion[]>(`/anotaciones?${qs.toString()}`),
    enabled,
  });
}

export function useCreateAnotacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { empleadoId: string; categoriaId?: string; texto: string; fecha?: string }) =>
      api.post<Anotacion>('/anotaciones', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anotaciones'] }),
  });
}

export function useUpdateAnotacion(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ categoriaId: string; texto: string; fecha: string }>) => api.patch<Anotacion>(`/anotaciones/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anotaciones'] }),
  });
}

export function useMarcarHecha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<Anotacion>(`/anotaciones/${id}/hecha`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anotaciones'] }),
  });
}

export function useReabrir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch<Anotacion>(`/anotaciones/${id}/reabrir`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anotaciones'] }),
  });
}

export function useDeleteAnotacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ id: string }>(`/anotaciones/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['anotaciones'] }),
  });
}
