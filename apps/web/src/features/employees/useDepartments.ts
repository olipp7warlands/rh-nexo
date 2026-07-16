import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { EmployeeRef } from './useEmployees';

export interface DepartmentWithMeta {
  id: string;
  name: string;
  color: string;
  leadId: string | null;
  lead?: EmployeeRef | null;
  _count: { members: number };
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get<DepartmentWithMeta[]>('/departments'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color: string; leadId?: string }) =>
      api.post<DepartmentWithMeta>('/departments', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useUpdateDepartment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ name: string; color: string; leadId: string }>) =>
      api.patch<DepartmentWithMeta>(`/departments/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<DepartmentWithMeta>(`/departments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments'] }),
  });
}
