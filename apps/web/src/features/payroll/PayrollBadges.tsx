import { Badge } from '@nucleo/ui';
import type { PayrollRunStatus, PayslipStatus } from './usePayroll';

const RUN_STATUS: Record<PayrollRunStatus, { variant: 'neutral' | 'success' | 'info'; label: string }> = {
  BORRADOR: { variant: 'neutral', label: 'Borrador' },
  PROCESADA: { variant: 'success', label: 'Procesada' },
  PAGADA: { variant: 'info', label: 'Pagada' },
};

const PAYSLIP_STATUS: Record<PayslipStatus, { variant: 'neutral' | 'success' | 'info'; label: string }> = {
  BORRADOR: { variant: 'neutral', label: 'Borrador' },
  EMITIDA: { variant: 'success', label: 'Emitida' },
  PAGADA: { variant: 'info', label: 'Pagada' },
};

export function PayrollRunStatusBadge({ status }: { status: PayrollRunStatus }) {
  const s = RUN_STATUS[status];
  return (
    <Badge variant={s.variant} dot>
      {s.label}
    </Badge>
  );
}

export function PayslipStatusBadge({ status }: { status: PayslipStatus }) {
  const s = PAYSLIP_STATUS[status];
  return (
    <Badge variant={s.variant} dot>
      {s.label}
    </Badge>
  );
}
