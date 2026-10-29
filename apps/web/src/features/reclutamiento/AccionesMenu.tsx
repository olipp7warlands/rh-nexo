import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MoreVertical } from 'lucide-react';
import { Button } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import {
  useDeleteApplication,
  useDeleteJob,
  useUpdateJob,
  type JobStatus,
  type JobSummary,
} from './useRecruitment';
import { EditarProcesoModal } from './EditarProcesoModal';

export interface MenuAction {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Si existe, el elemento queda inhabilitado (sigue siendo enfocable) y muestra este motivo. */
  disabledReason?: string;
}

/**
 * Menú de tres puntos operable por teclado (patrón WAI-ARIA «menu button»): Enter/Espacio/↓ abre,
 * ↑↓/Inicio/Fin navegan, Esc cierra y devuelve el foco, Tab cierra. Los elementos inhabilitados
 * usan aria-disabled (siguen enfocables para que el motivo sea legible) y no ejecutan nada.
 */
export function AccionesMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const focusItem = (i: number) => {
    const n = actions.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') (e.preventDefault(), focusItem(current + 1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), focusItem(current - 1));
    else if (e.key === 'Home') (e.preventDefault(), focusItem(0));
    else if (e.key === 'End') (e.preventDefault(), focusItem(actions.length - 1));
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close(true));
    else if (e.key === 'Tab') close(false);
  };

  return (
    // El contenedor frena el clic para que no active la navegación de la tarjeta/fila.
    <div ref={rootRef} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) (e.preventDefault(), setOpen(true));
        }}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className="absolute right-0 top-9 z-30 min-w-[220px] bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-lg shadow-lg py-1"
        >
          {actions.map((a, i) => (
            <button
              key={a.key}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={a.disabledReason ? true : undefined}
              title={a.disabledReason}
              onClick={() => {
                if (a.disabledReason) return;
                close(false);
                a.onSelect();
              }}
              className={`w-full text-left px-3 py-2 text-[13px] focus:outline-none focus:bg-[var(--bg-hover)] ${
                a.disabledReason
                  ? 'text-[var(--ink-disabled)] cursor-not-allowed'
                  : a.danger
                    ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)] focus:bg-[var(--danger-soft)]'
                    : 'text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {a.label}
              {a.disabledReason && <span className="block text-[11px] text-[var(--ink-tertiary)] mt-0.5">{a.disabledReason}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Diálogo de confirmación destructiva: nombra lo que se va a borrar. */
export function ConfirmarEliminarModal({
  title,
  message,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-[var(--ink-secondary)]">{message}</p>
      {error && (
        <div role="alert" className="mt-3 text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  );
}

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
  actividad,
}: {
  applicationId: string;
  candidateName: string;
  /** Hay entrevistas, evaluaciones o decisiones: no se puede borrar. */
  actividad: boolean;
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
            disabledReason: actividad ? 'Tiene actividad registrada: recházala, el historial no se borra.' : undefined,
          },
        ]}
      />
      {confirming && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmarEliminarModal
            title="Eliminar candidatura"
            message={`¿Eliminar la candidatura de «${candidateName}» a esta oferta? La persona seguirá existiendo como candidato. Esta acción no se puede deshacer.`}
            pending={remove.isPending}
            error={error}
            onClose={() => setConfirming(false)}
            onConfirm={() =>
              remove.mutate(applicationId, {
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
