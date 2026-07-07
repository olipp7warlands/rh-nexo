import { useState } from 'react';
import { Badge, Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useAuth } from '../auth/AuthContext';
import { useEmployees } from '../employees/useEmployees';
import { formatDate } from '../../lib/format';
import {
  useCandidate,
  useAddInterview,
  useUpdateInterview,
  useAddEvaluation,
  useRejectApplication,
  type JobDetail,
} from './useRecruitment';
import { ApplicationStatusBadge } from './RecruitmentBadges';
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
  const addInterview = useAddInterview();
  const updateInterview = useUpdateInterview();
  const addEvaluation = useAddEvaluation();
  const reject = useRejectApplication();

  const [hiring, setHiring] = useState(false);
  const [interviewType, setInterviewType] = useState('tecnica');
  const [interviewerId, setInterviewerId] = useState('');
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
              {candidate.phone && <div>{candidate.phone}</div>}
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
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold mb-2">Entrevistas</h3>
            <div className="flex flex-col gap-2 mb-3">
              {application.interviews.length === 0 && (
                <p className="text-[12px] text-[var(--ink-tertiary)]">Sin entrevistas programadas.</p>
              )}
              {application.interviews.map((iv) => (
                <div key={iv.id} className="flex items-center gap-3 text-[13px] px-3 py-2 bg-[var(--bg-subtle)] rounded-md">
                  <Badge variant="neutral">{iv.type}</Badge>
                  <span className="flex-1 text-[var(--ink-secondary)]">
                    {iv.scheduledAt ? formatDate(iv.scheduledAt) : 'Sin fecha'}
                    {iv.feedback ? ` · ${iv.feedback}` : ''}
                  </span>
                  <span className="text-[11px] text-[var(--ink-tertiary)]">{iv.status}</span>
                  {canManage && iv.status !== 'COMPLETADA' && (
                    <button
                      className="text-[11px] text-[var(--accent-ink)] font-medium"
                      onClick={() => updateInterview.mutate({ id: iv.id, status: 'COMPLETADA' })}
                    >
                      Marcar completada
                    </button>
                  )}
                </div>
              ))}
            </div>
            {canManage && (
              <div className="flex items-end gap-2">
                <select className={selectClass} value={interviewType} onChange={(e) => setInterviewType(e.target.value)}>
                  <option value="telefonica">Telefónica</option>
                  <option value="tecnica">Técnica</option>
                  <option value="cultural">Cultural</option>
                  <option value="final">Final</option>
                </select>
                <select className={selectClass} value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)}>
                  <option value="">Entrevistador…</option>
                  {employees?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={addInterview.isPending}
                  onClick={() =>
                    addInterview.mutate({ applicationId, type: interviewType, interviewerId: interviewerId || undefined })
                  }
                >
                  Programar
                </Button>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-[13px] font-semibold mb-2">Evaluaciones</h3>
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
              <h3 className="text-[13px] font-semibold mb-2">Traza de decisiones</h3>
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
