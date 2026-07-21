import { useEffect, useState } from 'react';
import { Avatar, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import {
  useCycle,
  useCycles,
  useUpdateKeyResult,
  useUpdateReview,
  type KeyResult,
  type Review,
} from './usePerformance';

function Check({ checked, disabled, onChange, label }: { checked: boolean; disabled: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={`flex items-center gap-1.5 text-[12px] ${disabled ? 'text-[var(--ink-tertiary)]' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function ReviewRow({ review, cycleId, canManage, ownEmployeeId }: { review: Review; cycleId: string; canManage: boolean; ownEmployeeId?: string | null }) {
  const update = useUpdateReview(cycleId);
  const isOwn = review.employeeId === ownEmployeeId;
  const set = (data: Partial<Pick<Review, 'selfDone' | 'managerDone' | 'o2oDone' | 'rating'>>) =>
    update.mutate({ id: review.id, data });

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Avatar name={review.employee.fullName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{review.employee.fullName}</div>
        <div className="text-[11px] text-[var(--ink-tertiary)] truncate">{review.employee.jobTitle}</div>
      </div>
      <div className="flex items-center gap-4">
        <Check label="Auto" checked={review.selfDone} disabled={!(canManage || isOwn)} onChange={(v) => set({ selfDone: v })} />
        <Check label="Manager" checked={review.managerDone} disabled={!canManage} onChange={(v) => set({ managerDone: v })} />
        <Check label="1:1" checked={review.o2oDone} disabled={!canManage} onChange={(v) => set({ o2oDone: v })} />
      </div>
      <input
        type="number"
        step="0.1"
        min={0}
        max={5}
        defaultValue={review.rating ?? ''}
        disabled={!canManage}
        placeholder="—"
        onBlur={(e) => {
          const v = e.target.value === '' ? undefined : Number(e.target.value);
          if (v !== (review.rating ?? undefined)) set({ rating: v });
        }}
        className="w-16 h-8 px-2 text-[13px] text-center mono bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md focus:border-[var(--accent)] focus:outline-none disabled:bg-[var(--bg-subtle)]"
        aria-label={`Valoración de ${review.employee.fullName}`}
      />
    </div>
  );
}

function KRRow({ kr, cycleId, canEdit }: { kr: KeyResult; cycleId: string; canEdit: boolean }) {
  const update = useUpdateKeyResult(cycleId);
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex-1 text-[13px]">{kr.title}</span>
      <div className="w-32 h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: `${kr.progress}%`, background: kr.progress >= 70 ? 'var(--success)' : kr.progress < 40 ? 'var(--warning)' : 'var(--accent)' }}
        />
      </div>
      <input
        type="number"
        min={0}
        max={100}
        defaultValue={kr.progress}
        disabled={!canEdit}
        onBlur={(e) => {
          const v = Math.max(0, Math.min(100, Number(e.target.value)));
          if (v !== kr.progress) update.mutate({ id: kr.id, progress: v });
        }}
        className="w-16 h-8 px-2 text-[13px] text-center mono bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md focus:border-[var(--accent)] focus:outline-none disabled:bg-[var(--bg-subtle)]"
        aria-label={`Progreso de ${kr.title}`}
      />
    </div>
  );
}

export function DesempenoPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH' || user?.role === 'MANAGER';
  const { data: cycles } = useCycles();
  const [cycleId, setCycleId] = useState('');
  useEffect(() => {
    const first = cycles?.[0];
    if (!cycleId && first) setCycleId(first.id);
  }, [cycles, cycleId]);
  const { data: cycle } = useCycle(cycleId);

  const rated = cycle?.reviews.filter((r) => r.rating != null) ?? [];
  const avg = rated.length ? (rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length).toFixed(1) : '—';
  const complete = cycle?.reviews.filter((r) => r.selfDone && r.managerDone && r.o2oDone).length ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Talento"
        title="Desempeño"
        subtitle="Ciclo de evaluación y OKRs."
        actions={
          cycles && cycles.length > 0 ? (
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Ciclo"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {cycle && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Valoración media</div>
              <div className="mono text-[28px] font-bold leading-none">{avg}<span className="text-[14px] text-[var(--ink-tertiary)]"> / 5</span></div>
            </div>
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Evaluaciones completas</div>
              <div className="mono text-[28px] font-bold leading-none">{complete}<span className="text-[14px] text-[var(--ink-tertiary)]"> / {cycle.reviews.length}</span></div>
            </div>
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Objetivos (OKR)</div>
              <div className="mono text-[28px] font-bold leading-none">{cycle.objectives.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {/* Reviews */}
            <Card padding="p-0" className="col-span-2">
              <div className="px-5 py-4 border-b border-[var(--line)]">
                <h3 className="font-serif text-[14px] font-medium">Evaluaciones</h3>
              </div>
              <div className="divide-y divide-[var(--line-subtle)]">
                {cycle.reviews.map((r) => (
                  <ReviewRow key={r.id} review={r} cycleId={cycle.id} canManage={canManage} ownEmployeeId={user?.employeeId} />
                ))}
              </div>
            </Card>

            {/* OKRs */}
            <div className="flex flex-col gap-5">
              {cycle.objectives.map((o) => {
                const canEdit = canManage || o.owner.id === user?.employeeId;
                return (
                  <Card key={o.id}>
                    <div className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] mb-1">{o.scope}</div>
                    <h4 className="font-serif text-[13px] font-medium mb-3">{o.title}</h4>
                    <div className="divide-y divide-[var(--line-subtle)]">
                      {o.keyResults.map((kr) => (
                        <KRRow key={kr.id} kr={kr} cycleId={cycle.id} canEdit={canEdit} />
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
