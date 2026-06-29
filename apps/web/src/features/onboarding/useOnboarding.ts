import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type OnboardingPhase = 'ANTES' | 'DIA1' | 'SEMANA1' | 'MES1';

export interface OnboardingTask {
  id: string;
  label: string;
  phase: OnboardingPhase;
  owner: string;
  done: boolean;
  doneAt: string | null;
}

export interface ProcessSummary {
  id: string;
  startDate: string;
  status: string;
  total: number;
  done: number;
  employee: { id: string; fullName: string; jobTitle: string; department?: { name: string; color: string } | null };
  buddy?: { id: string; fullName: string } | null;
}

export interface ProcessDetail extends Omit<ProcessSummary, 'total' | 'done'> {
  tasks: OnboardingTask[];
}

export const PHASE_LABEL: Record<OnboardingPhase, string> = {
  ANTES: 'Antes del primer día',
  DIA1: 'Primer día',
  SEMANA1: 'Primera semana',
  MES1: 'Primer mes',
};
export const PHASE_ORDER: OnboardingPhase[] = ['ANTES', 'DIA1', 'SEMANA1', 'MES1'];

export function useOnboardingProcesses() {
  return useQuery({ queryKey: ['onboarding'], queryFn: () => api.get<ProcessSummary[]>('/onboarding') });
}

export function useOnboardingProcess(id: string) {
  return useQuery({
    queryKey: ['onboarding', id],
    queryFn: () => api.get<ProcessDetail>(`/onboarding/${id}`),
    enabled: !!id,
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, done }: { taskId: string; done: boolean }) =>
      api.patch<OnboardingTask>(`/onboarding/tasks/${taskId}`, { done }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  });
}
