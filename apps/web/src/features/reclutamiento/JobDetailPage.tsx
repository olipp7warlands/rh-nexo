import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, Badge, Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../../lib/format';
import {
  useJob,
  useStages,
  useApplicationsByJob,
  useAutoScreen,
  useMoveStage,
  useRejectApplication,
  type ApplicationItem,
  type Stage,
} from './useRecruitment';
import { ApplicationStatusBadge, JobStatusBadge } from './RecruitmentBadges';
import { NuevaCandidaturaModal } from './NuevaCandidaturaModal';
import { CandidatePanel } from './CandidatePanel';

export function JobDetailPage() {
  const { jobId = '' } = useParams();
  const { user } = useAuth();
  const roleCanView = user?.role === 'ADMIN' || user?.role === 'RRHH' || user?.role === 'MANAGER';
  const { data: job, isError: jobError } = useJob(jobId, roleCanView);
  const { data: stages } = useStages(roleCanView);
  const { data: applications, isLoading } = useApplicationsByJob(jobId, roleCanView);
  const autoScreen = useAutoScreen();
  const moveStage = useMoveStage();
  const reject = useRejectApplication();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<{ candidateId: string; applicationId: string } | null>(null);
  const [screenResult, setScreenResult] = useState<string | null>(null);

  const canManage =
    user?.role === 'ADMIN' || user?.role === 'RRHH' || (user?.role === 'MANAGER' && job?.hiringManagerId === user.employeeId);
  const canHire = user?.role === 'ADMIN' || user?.role === 'RRHH';

  if (!roleCanView) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <PageHeader eyebrow="Talento" title="Selección" />
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            El reclutamiento contiene datos de candidatos y solo está disponible para managers, RRHH y Administración.
          </p>
        </Card>
      </div>
    );
  }

  if (jobError) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <Link to="/seleccion" className="text-[13px] text-[var(--accent-ink)] inline-flex items-center gap-1.5 mb-4">
          ← Selección
        </Link>
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">No tienes acceso a esta oferta.</p>
        </Card>
      </div>
    );
  }

  if (!job || !stages) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>
      </div>
    );
  }

  const onBoard = (applications ?? []).filter((a) => a.status === 'ACTIVO' || a.status === 'CONTRATADO');
  const discarded = (applications ?? []).filter((a) => a.status === 'RECHAZADO' || a.status === 'RETIRADO');

  const byStage = new Map<string, ApplicationItem[]>();
  for (const app of onBoard) {
    const key = app.stageId ?? '__none__';
    byStage.set(key, [...(byStage.get(key) ?? []), app]);
  }

  const nextStage = (stage: Stage | null): Stage | undefined => {
    if (!stage) return stages[0];
    return stages.find((s) => s.order === stage.order + 1);
  };

  const runScreen = async () => {
    const res = await autoScreen.mutateAsync(jobId);
    setScreenResult(`Cribado automático: ${res.advanced} avanzadas, ${res.rejected} descartadas.`);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10">
      <Link to="/seleccion" className="text-[13px] text-[var(--accent-ink)] inline-flex items-center gap-1.5 mb-4">
        ← Selección
      </Link>
      <PageHeader
        eyebrow={job.department?.name ?? 'Talento'}
        title={job.title}
        subtitle={`${job.location}${job.remote ? ' (remoto)' : ''} · ${job.level} · ${job.openings} ${
          job.openings === 1 ? 'apertura' : 'aperturas'
        }`}
        actions={
          <>
            <JobStatusBadge status={job.status} />
            {canManage && (
              <Button variant="secondary" onClick={() => setAdding(true)}>
                + Candidatura
              </Button>
            )}
          </>
        }
      />
      {job.description && <p className="text-[13px] text-[var(--ink-secondary)] mb-6 max-w-2xl">{job.description}</p>}
      {screenResult && (
        <div className="mb-4 text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2">{screenResult}</div>
      )}

      {isLoading && (
        <Card>
          <p className="text-[13px] text-[var(--ink-tertiary)]">Cargando pipeline…</p>
        </Card>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const cards = byStage.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="flex-shrink-0 w-72">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-[13px] font-medium flex items-center gap-1.5">
                  {stage.name}
                  <span className="mono text-[11px] text-[var(--ink-tertiary)]">{cards.length}</span>
                </h3>
                {stage.name === 'Nuevo' && canManage && (
                  <button
                    onClick={runScreen}
                    disabled={autoScreen.isPending || cards.length === 0}
                    className="text-[11px] text-[var(--accent-ink)] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cribado automático
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {cards.length === 0 && <p className="text-[12px] text-[var(--ink-tertiary)]">Sin candidatos.</p>}
                {cards.map((app) => {
                  const next = nextStage(app.stage);
                  const isLastBeforeHire = next?.name === 'Contratado';
                  return (
                    <div key={app.id} data-candidate={app.candidate.fullName}>
                    <Card padding="p-3">
                      <div
                        className="cursor-pointer"
                        onClick={() => setSelected({ candidateId: app.candidateId, applicationId: app.id })}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar name={app.candidate.fullName} size="xs" />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-medium truncate">{app.candidate.fullName}</div>
                            <div className="text-[10px] text-[var(--ink-tertiary)]">{formatDate(app.appliedAt)}</div>
                          </div>
                        </div>
                        {app.rating != null && <Badge variant="neutral">★ {app.rating.toFixed(1)}</Badge>}
                      </div>
                      {canManage && stage.name !== 'Contratado' && (
                        <div className="flex gap-1.5 mt-2 pt-2 border-t border-[var(--line-subtle)]">
                          {!isLastBeforeHire && next && (
                            <button
                              onClick={() => moveStage.mutate({ id: app.id, stageId: next.id })}
                              disabled={moveStage.isPending}
                              className="flex-1 h-7 text-[11px] font-medium rounded-md bg-[var(--bg-hover)] text-[var(--ink-primary)]"
                            >
                              Avanzar
                            </button>
                          )}
                          {isLastBeforeHire && canHire && (
                            <button
                              onClick={() => setSelected({ candidateId: app.candidateId, applicationId: app.id })}
                              className="flex-1 h-7 text-[11px] font-medium rounded-md bg-[var(--success)] text-white"
                            >
                              Contratar
                            </button>
                          )}
                          <button
                            onClick={() => reject.mutate({ id: app.id })}
                            disabled={reject.isPending}
                            className="h-7 px-2 text-[11px] font-medium rounded-md text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {discarded.length > 0 && (
        <div className="mt-8">
          <h3 className="font-serif text-[13px] font-medium mb-3">Descartados / retirados</h3>
          <Card padding="p-0">
            <div className="divide-y divide-[var(--line-subtle)]">
              {discarded.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-subtle)]"
                  onClick={() => setSelected({ candidateId: app.candidateId, applicationId: app.id })}
                >
                  <Avatar name={app.candidate.fullName} size="xs" />
                  <span className="flex-1 text-[13px]">{app.candidate.fullName}</span>
                  <ApplicationStatusBadge status={app.status} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {adding && <NuevaCandidaturaModal jobId={jobId} onClose={() => setAdding(false)} />}
      {selected && (
        <CandidatePanel
          candidateId={selected.candidateId}
          applicationId={selected.applicationId}
          job={job}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
