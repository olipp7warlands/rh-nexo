import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type PayrollRunStatus = 'BORRADOR' | 'PROCESADA' | 'PAGADA';
export type PayslipStatus = 'BORRADOR' | 'EMITIDA' | 'PAGADA';
export type PayrollItemType = 'BONUS' | 'HORAS_EXTRA' | 'DEDUCCION';

export const PAYROLL_ITEM_TYPE_LABEL: Record<PayrollItemType, string> = {
  BONUS: 'Bonus',
  HORAS_EXTRA: 'Horas extra',
  DEDUCCION: 'Deducción',
};

export interface PayrollRunSummary {
  id: string;
  period: string;
  status: PayrollRunStatus;
  totalGross: number;
  totalCost: number;
  processedAt: string | null;
  createdAt: string;
  _count: { payslips: number };
}

export interface Payslip {
  id: string;
  employeeId: string;
  gross: number;
  irpf: number;
  ss: number;
  net: number;
  status: PayslipStatus;
  pdfUrl: string | null;
  employee: { id: string; fullName: string; jobTitle: string; iban: string | null };
}

export interface PayrollItem {
  id: string;
  employeeId: string;
  type: PayrollItemType;
  concept: string;
  amount: number;
  employee: { id: string; fullName: string };
}

export interface PayrollRunDetail extends Omit<PayrollRunSummary, '_count'> {
  payslips: Payslip[];
  items: PayrollItem[];
}

export interface MyPayslip {
  id: string;
  gross: number;
  irpf: number;
  ss: number;
  net: number;
  status: PayslipStatus;
  pdfUrl: string | null;
  run: { period: string; status: PayrollRunStatus };
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['payroll'] });
}

export function usePayrollRuns() {
  return useQuery({ queryKey: ['payroll', 'runs'], queryFn: () => api.get<PayrollRunSummary[]>('/payroll/runs') });
}

export function usePayrollRun(id: string) {
  return useQuery({
    queryKey: ['payroll', 'runs', id],
    queryFn: () => api.get<PayrollRunDetail>(`/payroll/runs/${id}`),
    enabled: !!id,
  });
}

export function useMyPayslips() {
  return useQuery({ queryKey: ['payroll', 'mine'], queryFn: () => api.get<MyPayslip[]>('/payroll/mine') });
}

export function useGenerateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => api.post<PayrollRunDetail>('/payroll/runs', { period }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddPayrollItem(runId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { employeeId: string; type: PayrollItemType; concept: string; amount: number }) =>
      api.post<PayrollRunDetail>(`/payroll/runs/${runId}/items`, data),
    onSuccess: () => invalidate(qc),
  });
}

export function useProcessRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api.patch<PayrollRunDetail>(`/payroll/runs/${runId}/process`, {}),
    onSuccess: () => invalidate(qc),
  });
}
