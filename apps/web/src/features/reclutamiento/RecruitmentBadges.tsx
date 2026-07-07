import { Badge } from '@nucleo/ui';
import { JOB_STATUS_LABEL, type ApplicationStatus, type JobStatus } from './useRecruitment';

const JOB_STATUS: Record<JobStatus, { variant: 'neutral' | 'success' | 'warning'; label: string }> = {
  BORRADOR: { variant: 'neutral', label: 'Borrador' },
  ABIERTA: { variant: 'success', label: 'Activa' },
  PAUSADA: { variant: 'warning', label: 'Pausada' },
  CERRADA: { variant: 'neutral', label: 'Cerrada' },
};

const APPLICATION_STATUS: Record<ApplicationStatus, { variant: 'info' | 'danger' | 'success' | 'neutral'; label: string }> = {
  ACTIVO: { variant: 'info', label: 'En proceso' },
  RECHAZADO: { variant: 'danger', label: 'Descartado' },
  CONTRATADO: { variant: 'success', label: 'Contratado' },
  RETIRADO: { variant: 'neutral', label: 'Retirado' },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const s = JOB_STATUS[status];
  return (
    <Badge variant={s.variant} dot>
      {JOB_STATUS_LABEL[status] ?? s.label}
    </Badge>
  );
}

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const s = APPLICATION_STATUS[status];
  return (
    <Badge variant={s.variant} dot>
      {s.label}
    </Badge>
  );
}
