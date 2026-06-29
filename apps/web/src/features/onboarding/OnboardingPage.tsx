import { useEffect, useState } from 'react';
import { Avatar, Card, DeptChip, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import {
  PHASE_LABEL,
  PHASE_ORDER,
  useOnboardingProcess,
  useOnboardingProcesses,
  useToggleTask,
  type OnboardingPhase,
} from './useOnboarding';

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">
        {done}/{total} tareas · {pct}%
      </p>
    </div>
  );
}

export function OnboardingPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH' || user?.role === 'MANAGER';
  const { data: processes, isLoading } = useOnboardingProcesses();
  const [selected, setSelected] = useState<string>('');
  useEffect(() => {
    const first = processes?.[0];
    if (!selected && first) setSelected(first.id);
  }, [processes, selected]);

  const { data: detail } = useOnboardingProcess(selected);
  const toggle = useToggleTask();

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow="Talento" title="Onboarding" subtitle="Procesos de incorporación y su progreso." />

      {isLoading && <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p></Card>}
      {processes && processes.length === 0 && (
        <Card><p className="text-[13px] text-[var(--ink-tertiary)]">No hay procesos de onboarding activos.</p></Card>
      )}

      {processes && processes.length > 0 && (
        <div className="grid grid-cols-3 gap-5">
          {/* Lista */}
          <div className="flex flex-col gap-3">
            {processes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  selected === p.id
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]/40'
                    : 'border-[var(--line)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={p.employee.fullName} size="sm" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold truncate">{p.employee.fullName}</div>
                    <div className="text-[11px] text-[var(--ink-tertiary)] truncate">{p.employee.jobTitle}</div>
                  </div>
                </div>
                <ProgressBar done={p.done} total={p.total} />
              </button>
            ))}
          </div>

          {/* Checklist */}
          <div className="col-span-2">
            {detail && (
              <Card>
                <div className="flex items-center gap-3 mb-5">
                  <Avatar name={detail.employee.fullName} size="md" />
                  <div className="flex-1">
                    <h3 className="text-[15px] font-semibold">{detail.employee.fullName}</h3>
                    <div className="flex items-center gap-2 text-[12px] text-[var(--ink-secondary)]">
                      {detail.employee.jobTitle}
                      {detail.employee.department && <DeptChip name={detail.employee.department.name} color={detail.employee.department.color} />}
                    </div>
                  </div>
                  {detail.buddy && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)]">Buddy</div>
                      <div className="text-[12px] font-medium">{detail.buddy.fullName}</div>
                    </div>
                  )}
                </div>

                {PHASE_ORDER.map((phase: OnboardingPhase) => {
                  const tasks = detail.tasks.filter((t) => t.phase === phase);
                  if (tasks.length === 0) return null;
                  return (
                    <div key={phase} className="mb-5 last:mb-0">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--ink-tertiary)] mb-2">
                        {PHASE_LABEL[phase]}
                      </div>
                      <div className="flex flex-col gap-1">
                        {tasks.map((t) => (
                          <label
                            key={t.id}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md ${canManage ? 'hover:bg-[var(--bg-subtle)] cursor-pointer' : ''}`}
                          >
                            <input
                              type="checkbox"
                              checked={t.done}
                              disabled={!canManage || toggle.isPending}
                              onChange={(e) => toggle.mutate({ taskId: t.id, done: e.target.checked })}
                              className="w-4 h-4 accent-[var(--accent)]"
                            />
                            <span className={`flex-1 text-[13px] ${t.done ? 'line-through text-[var(--ink-tertiary)]' : ''}`}>
                              {t.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--ink-secondary)]">
                              {t.owner}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
