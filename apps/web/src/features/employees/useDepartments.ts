import { useQuery } from '@tanstack/react-query';
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
