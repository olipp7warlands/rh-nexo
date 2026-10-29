import { useState } from 'react';
import { AccionesMenu, ConfirmarEliminarModal, type MenuAction } from '../_shared/AccionesMenu';
import {
  useDeleteApplication,
  useDeleteJob,
  useUpdateJob,
  type JobStatus,
  type JobSummary,
} from './useRecruitment';
import { EditarProcesoModal } from './EditarProcesoModal';

/**
 * Acciones rápidas de una oferta (tarjeta y listado): Editar proceso, Pausar/Reabrir/Cerrar según
 * el estado y Eliminar. Solo se monta para ADMIN/RRHH (la UI oculta; el servidor lo exige igual).
 * Eliminar solo está disponible con 0 candidaturas: el historial no se borra.
 */
export function OfertaAccionesMenu({ job }: { job: JobSummary }) {
  const update = useUpdateJob();
  const remove = useDeleteJob();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setStatus = (status: JobStatus) => {
    setActionError(null);
    update.mutate({ id: job.id, status }, { onError: (e) => setActionError((e as Error).message) });
  };

  const actions: MenuAction[] = [{ key: 'editar', label: 'Editar proceso', onSelect: () => setEditing(true) }];
  if (job.status === 'ABIERTA') actions.push({ key: 'pausar', label: 'Pausar', onSelect: () => setStatus('PAUSADA') });
  if (job.status === 'PAUSADA') actions.push({ key: 'reabrir', label: 'Reabrir', onSelect: () => setStatus('ABIERTA') });
  if (job.status === 'ABIERTA' || job.status === 'PAUSADA') {
    actions.push({ key: 'cerrar', label: 'Cerrar', onSelect: () => setStatus('CERRADA') });
  }
  if (job.status === 'CERRADA') actions.push({ key: 'reabrir', label: 'Reabrir', onSelect: () => setStatus('ABIERTA') });
  if (job.status === 'BORRADOR') actions.push({ key: 'abrir', label: 'Abrir', onSelect: () => setStatus('ABIERTA') });
  actions.push({
    key: 'eliminar',
    label: 'Eliminar',
    danger: true,
    onSelect: () => {
      setError(null);
      setConfirming(true);
    },
    disabledReason: job.totalApplications > 0 ? 'Tiene candidaturas: ciérrala, el historial no se borra.' : undefined,
  });

  return (
    <>
      <AccionesMenu label={`Acciones de la oferta ${job.title}`} actions={actions} />
      {actionError && (
        <span role="alert" className="block text-[11px] text-[var(--danger)] mt-1 max-w-[220px]">
          {actionError}
        </span>
      )}
      {editing && (
        <div onClick={(e) => e.stopPropagation()}>
          <EditarProcesoModal job={job} onClose={() => setEditing(false)} />
        </div>
      )}
      {confirming && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmarEliminarModal
            title="Eliminar oferta"
            message={`¿Eliminar la oferta «${job.title}»? No tiene candidaturas. Esta acción no se puede deshacer.`}
            pending={remove.isPending}
            error={error}
            onClose={() => setConfirming(false)}
            onConfirm={() =>
              remove.mutate(job.id, {
                onSuccess: () => setConfirming(false),
                onError: (e) => setError((e as Error).message),
              })
            }
          />
        </div>
      )}
    </>
  );
}

/** Eliminar una candidatura concreta (el candidato permanece). Solo sin actividad registrada. */
export function CandidaturaAccionesMenu({
  applicationId,
  candidateName,
  conteo,
  onDeleted,
}: {
  applicationId: string;
  candidateName: string;
  /** Lo que se borrará en cascada junto con la candidatura. */
  conteo: { entrevistas: number; evaluaciones: number; decisiones: number };
  onDeleted?: () => void;
}) {
  const remove = useDeleteApplication();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <AccionesMenu
        label={`Acciones de la candidatura de ${candidateName}`}
        actions={[
          {
            key: 'eliminar',
            label: 'Eliminar candidatura',
            danger: true,
            onSelect: () => {
              setError(null);
              setConfirming(true);
            },
          },
        ]}
      />
      {confirming && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmarEliminarModal
            title="Eliminar candidatura"
            message={`¿Eliminar la candidatura de «${candidateName}» a esta oferta? Se borrará también la traza del proceso de esta candidatura: ${conteo.entrevistas} entrevistas, ${conteo.evaluaciones} evaluaciones y ${conteo.decisiones} decisiones. La persona seguirá existiendo como candidato y el registro de auditoría conserva una entrada de este borrado. Esta acción no se puede deshacer.`}
            pending={remove.isPending}
            error={error}
            onClose={() => setConfirming(false)}
            onConfirm={() =>
              remove.mutate(applicationId, {
                onSuccess: () => {
                  setConfirming(false);
                  onDeleted?.();
                },
                onError: (e) => setError((e as Error).message),
              })
            }
          />
        </div>
      )}
    </>
  );
}
