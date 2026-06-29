import { Badge } from '@nucleo/ui';
import { ABSENCE_TYPE_LABEL, type AbsenceStatus, type AbsenceType } from './useAbsences';

const STATUS: Record<AbsenceStatus, { variant: 'success' | 'warning' | 'danger'; label: string }> = {
  APROBADA: { variant: 'success', label: 'Aprobada' },
  PENDIENTE: { variant: 'warning', label: 'Pendiente' },
  RECHAZADA: { variant: 'danger', label: 'Rechazada' },
};

export function AbsenceStatusBadge({ status }: { status: AbsenceStatus }) {
  const s = STATUS[status];
  return (
    <Badge variant={s.variant} dot>
      {s.label}
    </Badge>
  );
}

export function AbsenceTypeBadge({ type }: { type: AbsenceType }) {
  return <Badge variant="neutral">{ABSENCE_TYPE_LABEL[type]}</Badge>;
}
