import { Badge } from '@nucleo/ui';
import type { DocumentStatus } from './useDocuments';

const STATUS: Record<DocumentStatus, { variant: 'success' | 'warning' | 'info'; label: string }> = {
  VIGENTE: { variant: 'success', label: 'Vigente' },
  FIRMADO: { variant: 'success', label: 'Firmado' },
  PENDIENTE: { variant: 'warning', label: 'Pendiente firma' },
  EMITIDO: { variant: 'info', label: 'Emitido' },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const s = STATUS[status];
  return (
    <Badge variant={s.variant} dot>
      {s.label}
    </Badge>
  );
}
