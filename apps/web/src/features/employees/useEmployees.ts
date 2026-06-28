import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface Employee {
  id: string; fullName: string; email: string; jobTitle: string; level: string;
  location: string; remote: boolean; startDate: string; status: 'ACTIVO' | 'ONBOARDING' | 'AUSENTE' | 'BAJA';
  salary: number | null; departmentId: string | null;
  department?: { id: string; name: string; color: string } | null;
  manager?: { id: string; fullName: string } | null;
}

export function useEmployees(params: { search?: string; departmentId?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  return useQuery({
    queryKey: ['employees', params],
    queryFn: () => api.get<Employee[]>(`/employees?${qs.toString()}`),
  });
}

export function useEmployee(id: string) {
  return useQuery({ queryKey: ['employee', id], queryFn: () => api.get<Employee>(`/employees/${id}`), enabled: !!id });
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
