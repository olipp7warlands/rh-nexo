import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export interface CycleSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  _count: { reviews: number; objectives: number };
}

export interface Review {
  id: string;
  employeeId: string;
  selfDone: boolean;
  managerDone: boolean;
  o2oDone: boolean;
  rating: number | null;
  employee: { id: string; fullName: string; jobTitle: string; managerId: string | null; department?: { name: string; color: string } | null };
  reviewer?: { id: string; fullName: string } | null;
}

export interface KeyResult {
  id: string;
  title: string;
  progress: number;
}
export interface Objective {
  id: string;
  scope: string;
  title: string;
  owner: { id: string; fullName: string };
  keyResults: KeyResult[];
}

export interface CycleDetail extends CycleSummary {
  reviews: Review[];
  objectives: Objective[];
}

export function useCycles() {
  return useQuery({ queryKey: ['cycles'], queryFn: () => api.get<CycleSummary[]>('/performance/cycles') });
}

export function useCycle(id: string) {
  return useQuery({
    queryKey: ['cycle', id],
    queryFn: () => api.get<CycleDetail>(`/performance/cycles/${id}`),
    enabled: !!id,
  });
}

export function useUpdateReview(cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Review, 'selfDone' | 'managerDone' | 'o2oDone' | 'rating'>> }) =>
      api.patch<Review>(`/performance/reviews/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle', cycleId] }),
  });
}

export function useUpdateKeyResult(cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) =>
      api.patch<KeyResult>(`/performance/key-results/${id}`, { progress }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycle', cycleId] }),
  });
}
