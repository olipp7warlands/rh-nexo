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
