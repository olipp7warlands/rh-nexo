import { useState } from 'react';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useProyectos } from '../estructura/useEstructura';
import { useUpdateJob, type JobDetail, type JobStatus } from './useRecruitment';

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';
const labelClass = 'block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5';
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/**
 * Edita el ciclo de vida de una oferta: estado, apertura, cierre (solo si está cerrada) y proyecto.
 * Al volver a abrir una oferta cerrada, el servidor pone el cierre a NULL.
 */
export function EditarProcesoModal({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const { data: proyectos } = useProyectos();
  const update = useUpdateJob();
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [openedAt, setOpenedAt] = useState(day(job.openedAt));
  const [closedAt, setClosedAt] = useState(day(job.closedAt));
  const [proyectoId, setProyectoId] = useState(job.proyectoId ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!openedAt) return setError('La fecha de apertura es obligatoria.');
    if (status === 'CERRADA') {
      if (!closedAt) return setError('Indica la fecha de cierre.');
      if (closedAt < openedAt) return setError('La fecha de cierre no puede ser anterior a la de apertura.');
    }
    try {
      await update.mutateAsync({
        id: job.id,
        status,
        openedAt,
        closedAt: status === 'CERRADA' ? closedAt : undefined,
        proyectoId: proyectoId || undefined,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal
      title="Editar proceso"
      subtitle={job.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={update.isPending}>
            {update.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="edit-estado" className={labelClass}>
              Estado
            </label>
            <select id="edit-estado" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
              <option value="BORRADOR">Borrador</option>
              <option value="ABIERTA">Abierta</option>
              <option value="PAUSADA">Pausada</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-apertura" className={labelClass}>
              Fecha de apertura
            </label>
            <Input id="edit-apertura" type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
          </div>
          {status === 'CERRADA' && (
            <div>
              <label htmlFor="edit-cierre" className={labelClass}>
                Fecha de cierre
              </label>
              <Input id="edit-cierre" type="date" value={closedAt} min={openedAt || undefined} onChange={(e) => setClosedAt(e.target.value)} />
            </div>
          )}
        </div>
        {job.status === 'CERRADA' && status !== 'CERRADA' && (
          <p className="text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2">
            Al reabrir la oferta se elimina su fecha de cierre.
          </p>
        )}
        <div>
          <label htmlFor="edit-proyecto" className={labelClass}>
            Proyecto
          </label>
          <select id="edit-proyecto" className={selectClass} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            <option value="">Sin proyecto</option>
            {proyectos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
