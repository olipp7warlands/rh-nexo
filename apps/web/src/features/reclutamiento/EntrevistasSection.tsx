import { useState } from 'react';
import { Badge, Button, Input } from '@nucleo/ui';
import { formatDate } from '../../lib/format';
import { useEmployees } from '../employees/useEmployees';
import { useAddInterview, useDeleteInterview, useUpdateInterview, type InterviewItem } from './useRecruitment';
import { INTERVIEW_TYPE_OPTIONS, interviewTypeLabel } from './fuentes';
import { ConfirmarEliminarModal } from '../_shared/AccionesMenu';

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

interface Draft {
  key: number;
  type: string;
  interviewerId: string;
  scheduledAt: string;
}

const newDraft = (key: number): Draft => ({ key, type: INTERVIEW_TYPE_OPTIONS[0]?.value ?? 'telefonica', interviewerId: '', scheduledAt: '' });

/**
 * Entrevistas de una candidatura: «+ Añadir entrevista» abre una fila (tipo, entrevistador, fecha)
 * que se programa por separado, así que se pueden preparar varias; debajo, la lista de las ya
 * registradas con opción de marcarlas completadas o eliminar las programadas (auditado en servidor).
 */
export function EntrevistasSection({
  applicationId,
  interviews,
  canManage,
}: {
  applicationId: string;
  interviews: InterviewItem[];
  canManage: boolean;
}) {
  const { data: employees } = useEmployees();
  const add = useAddInterview();
  const update = useUpdateInterview();
  const remove = useDeleteInterview();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<InterviewItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const patchDraft = (key: number, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const dropDraft = (key: number) => setDrafts((ds) => ds.filter((d) => d.key !== key));
  const addDraft = () => {
    setDrafts((ds) => [...ds, newDraft(nextKey)]);
    setNextKey((k) => k + 1);
  };

  const schedule = (d: Draft) => {
    setError(null);
    add.mutate(
      { applicationId, type: d.type, interviewerId: d.interviewerId || undefined, scheduledAt: d.scheduledAt || undefined },
      { onSuccess: () => dropDraft(d.key), onError: (e) => setError((e as Error).message) },
    );
  };

  const interviewerName = (id: string | null) => employees?.find((e) => e.id === id)?.fullName ?? 'Sin entrevistador';

  return (
    <div>
      <h3 className="font-serif text-[13px] font-medium mb-2">Entrevistas</h3>

      {canManage && (
        <div className="mb-3">
          {drafts.map((d, i) => (
            <div key={d.key} className="flex items-end gap-2 mb-2" role="group" aria-label={`Nueva entrevista ${i + 1}`}>
              <select
                aria-label="Tipo de entrevista"
                className={selectClass}
                value={d.type}
                onChange={(e) => patchDraft(d.key, { type: e.target.value })}
              >
                {INTERVIEW_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Entrevistador"
                className={selectClass}
                value={d.interviewerId}
                onChange={(e) => patchDraft(d.key, { interviewerId: e.target.value })}
              >
                <option value="">Entrevistador…</option>
                {employees?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fullName}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Fecha de la entrevista"
                type="date"
                value={d.scheduledAt}
                onChange={(e) => patchDraft(d.key, { scheduledAt: e.target.value })}
              />
              <Button variant="secondary" type="button" disabled={add.isPending} onClick={() => schedule(d)}>
                Programar
              </Button>
              <button
                type="button"
                aria-label="Descartar esta fila"
                className="h-9 px-2 text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                onClick={() => dropDraft(d.key)}
              >
                ✕
              </button>
            </div>
          ))}
          <Button variant="ghost" type="button" onClick={addDraft}>
            + Añadir entrevista
          </Button>
          {error && (
            <p role="alert" className="text-[12px] text-[var(--danger)] mt-1.5">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2" role="list" aria-label="Entrevistas registradas">
        {interviews.length === 0 && <p className="text-[12px] text-[var(--ink-tertiary)]">Sin entrevistas programadas.</p>}
        {interviews.map((iv) => (
          <div key={iv.id} role="listitem" className="flex items-center gap-3 text-[13px] px-3 py-2 bg-[var(--bg-subtle)] rounded-md">
            <Badge variant="neutral">{interviewTypeLabel(iv.type)}</Badge>
            <span className="flex-1 text-[var(--ink-secondary)]">
              {interviewerName(iv.interviewerId)} · {iv.scheduledAt ? formatDate(iv.scheduledAt) : 'Sin fecha'}
              {iv.feedback ? ` · ${iv.feedback}` : ''}
            </span>
            <span className="text-[11px] text-[var(--ink-tertiary)]">{iv.status}</span>
            {canManage && iv.status !== 'COMPLETADA' && (
              <>
                <button
                  type="button"
                  className="text-[11px] text-[var(--accent-ink)] font-medium"
                  onClick={() => update.mutate({ id: iv.id, status: 'COMPLETADA' })}
                >
                  Marcar completada
                </button>
                <button
                  type="button"
                  aria-label={`Eliminar entrevista ${interviewTypeLabel(iv.type)}`}
                  className="text-[11px] text-[var(--danger)] font-medium"
                  onClick={() => {
                    setDeleteError(null);
                    setToDelete(iv);
                  }}
                >
                  Eliminar
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {toDelete && (
        <ConfirmarEliminarModal
          title="Eliminar entrevista"
          message={`¿Eliminar la entrevista ${interviewTypeLabel(toDelete.type).toLowerCase()} programada (${interviewerName(toDelete.interviewerId)}, ${
            toDelete.scheduledAt ? formatDate(toDelete.scheduledAt) : 'sin fecha'
          })? Queda registrado en la auditoría. Esta acción no se puede deshacer.`}
          pending={remove.isPending}
          error={deleteError}
          onClose={() => setToDelete(null)}
          onConfirm={() =>
            remove.mutate(toDelete.id, {
              onSuccess: () => setToDelete(null),
              onError: (e) => setDeleteError((e as Error).message),
            })
          }
        />
      )}
    </div>
  );
}
