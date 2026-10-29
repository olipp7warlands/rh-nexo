import { useState } from 'react';
import { Badge, Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useAuth } from '../auth/AuthContext';
import { useEmployees } from '../employees/useEmployees';
import { formatDate } from '../../lib/format';
import {
  useCandidate,
  useAddEvaluation,
  useRejectApplication,
  useUpdateApplicationDates,
  type JobDetail,
} from './useRecruitment';
import { ApplicationStatusBadge } from './RecruitmentBadges';
import { sourceText } from './fuentes';
import { EntrevistasSection } from './EntrevistasSection';
import { CandidaturaAccionesMenu } from './AccionesMenu';
import { ContratarModal } from './ContratarModal';

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function CandidatePanel({
  candidateId,
  applicationId,
  job,
  onClose,
}: {
  candidateId: string;
  applicationId: string;
  job: JobDetail;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: candidate, isLoading } = useCandidate(candidateId);
  const { data: employees } = useEmployees();
  const addEvaluation = useAddEvaluation();
  const reject = useRejectApplication();
  const updateDates = useUpdateApplicationDates();
  const [editingDates, setEditingDates] = useState(false);
  const [appliedAtDraft, setAppliedAtDraft] = useState('');
  const [incorpDraft, setIncorpDraft] = useState('');
  const [datesError, setDatesError] = useState<string | null>(null);

  const [hiring, setHiring] = useState(false);
  const [evalScore, setEvalScore] = useState('');
  const [evalRecommendation, setEvalRecommendation] = useState('');

  const canHire = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const canManage =
    user?.role === 'ADMIN' || user?.role === 'RRHH' || (user?.role === 'MANAGER' && job.hiringManagerId === user.employeeId);

  const application = candidate?.applications.find((a) => a.id === applicationId);

  if (hiring && candidate && application) {
    return (
      <ContratarModal
        applicationId={applicationId}
        job={job}
        candidateFullName={candidate.fullName}
        onClose={() => setHiring(false)}
        onHired={() => {
          setHiring(false);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal title={candidate?.fullName ?? 'Candidato'} subtitle={application?.job.title} onClose={onClose} wide>
      {isLoading && <p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>}
      {candidate && application && (
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <div className="text-[13px] text-[var(--ink-secondary)] space-y-1">
              <div>{candidate.email}</div>
              <div>Fuente: {sourceText(candidate.source, candidate.fuenteDetalle)}</div>
              {candidate.phone && <div>{candidate.phone}</div>}
              {candidate.location && <div>{candidate.location}</div>}
              {candidate.linkedinUrl && (
                <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)]">
                  LinkedIn ↗
                </a>
              )}
              {candidate.resumeUrl && (
                <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)] block">
                  Ver CV ↗
                </a>
              )}
              {!candidate.resumeUrl && <div className="text-[var(--danger)]">Sin CV adjunto</div>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <ApplicationStatusBadge status={application.status} />
              {application.status === 'ACTIVO' && (
                <div className="flex gap-2">
                  {canHire && (
                    <Button variant="primary" onClick={() => setHiring(true)}>
                      Contratar
                    </Button>
                  )}
                  {canManage && (
                    <Button variant="secondary" onClick={() => reject.mutate({ id: applicationId })} disabled={reject.isPending}>
                      Rechazar
                    </Button>
                  )}
                </div>
              )}
              {canHire && (
                <CandidaturaAccionesMenu
                  applicationId={applicationId}
                  candidateName={candidate.fullName}
                  conteo={{
                    entrevistas: application.interviews.length,
                    evaluaciones: application.evaluations.length,
                    decisiones: application.decisions.length,
                  }}
                  onDeleted={onClose}
                />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-serif text-[13px] font-medium">Fechas</h3>
              {canHire && !editingDates && (
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setAppliedAtDraft(application.appliedAt.slice(0, 10));
                    setIncorpDraft(application.fechaIncorporacion?.slice(0, 10) ?? '');
                    setDatesError(null);
                    setEditingDates(true);
                  }}
                >
                  Editar fechas
                </Button>
              )}
            </div>
            {!editingDates ? (
              <div className="text-[13px] text-[var(--ink-secondary)] space-y-0.5">
                <div>Postulación: {formatDate(application.appliedAt)}</div>
                {application.status === 'CONTRATADO' && (
                  <div>Incorporación: {application.fechaIncorporacion ? formatDate(application.fechaIncorporacion) : '—'}</div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="panel-postulacion" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
                      Fecha de postulación
                    </label>
                    <Input id="panel-postulacion" type="date" value={appliedAtDraft} onChange={(e) => setAppliedAtDraft(e.target.value)} />
                  </div>
                  {application.status === 'CONTRATADO' && (
                    <div>
                      <label htmlFor="panel-incorporacion" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
                        Fecha de incorporación
                      </label>
                      <Input id="panel-incorporacion" type="date" value={incorpDraft} onChange={(e) => setIncorpDraft(e.target.value)} />
                    </div>
                  )}
                </div>
                {datesError && (
                  <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
                    {datesError}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    type="button"
                    disabled={updateDates.isPending || !appliedAtDraft}
                    onClick={async () => {
                      setDatesError(null);
                      try {
                        await updateDates.mutateAsync({
                          id: applicationId,
                          appliedAt: appliedAtDraft,
                          fechaIncorporacion: application.status === 'CONTRATADO' && incorpDraft ? incorpDraft : undefined,
                        });
                        setEditingDates(false);
                      } catch (e) {
                        setDatesError((e as Error).message);
                      }
                    }}
                  >
                    {updateDates.isPending ? 'Guardando…' : 'Guardar fechas'}
                  </Button>
                  <Button variant="ghost" type="button" onClick={() => setEditingDates(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <EntrevistasSection applicationId={applicationId} interviews={application.interviews} canManage={canManage} />

          <div>
            <h3 className="font-serif text-[13px] font-medium mb-2">Evaluaciones</h3>
            <div className="flex flex-col gap-2 mb-3">
              {application.evaluations.length === 0 && (
                <p className="text-[12px] text-[var(--ink-tertiary)]">Sin evaluaciones registradas.</p>
              )}
              {application.evaluations.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 text-[13px] px-3 py-2 bg-[var(--bg-subtle)] rounded-md">
                  {ev.score != null && <span className="mono font-semibold">★ {ev.score}</span>}
                  <span className="flex-1 text-[var(--ink-secondary)]">{ev.strengths}</span>
                  {ev.recommendation && <Badge variant="neutral">{ev.recommendation}</Badge>}
                </div>
              ))}
            </div>
            {canManage && (
              <div className="flex items-end gap-2">
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  placeholder="Puntuación"
                  value={evalScore}
                  onChange={(e) => setEvalScore(e.target.value)}
                />
                <select className={selectClass} value={evalRecommendation} onChange={(e) => setEvalRecommendation(e.target.value)}>
                  <option value="">Recomendación…</option>
                  <option value="contratar">Contratar</option>
                  <option value="dudoso">Dudoso</option>
                  <option value="rechazar">Rechazar</option>
                </select>
                <Button
                  variant="secondary"
                  disabled={addEvaluation.isPending}
                  onClick={() =>
                    addEvaluation.mutate({
                      applicationId,
                      score: evalScore ? Number(evalScore) : undefined,
                      recommendation: evalRecommendation || undefined,
                    })
                  }
                >
                  Añadir
                </Button>
              </div>
            )}
          </div>

          {application.decisions.length > 0 && (
            <div>
              <h3 className="font-serif text-[13px] font-medium mb-2">Traza de decisiones</h3>
              <div className="flex flex-col gap-1.5">
                {application.decisions.map((d) => (
                  <div key={d.id} className="text-[12px] text-[var(--ink-secondary)] flex items-center gap-2">
                    <Badge variant={d.automated ? 'accent' : 'neutral'}>{d.automated ? 'Automático' : 'Manual'}</Badge>
                    <span className="flex-1">{d.reason}</span>
                    <span className="text-[11px] text-[var(--ink-tertiary)]">{formatDate(d.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
