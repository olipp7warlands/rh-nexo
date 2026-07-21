import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useJobs, type JobStatus } from './useRecruitment';
import { JobStatusBadge } from './RecruitmentBadges';
import { NuevaOfertaModal } from './NuevaOfertaModal';

const FILTERS: { key: JobStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'ABIERTA', label: 'Activas' },
  { key: 'PAUSADA', label: 'Pausadas' },
  { key: 'CERRADA', label: 'Cerradas' },
];

export function ReclutamientoPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const canView = canManage || user?.role === 'MANAGER';
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useJobs(canView);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);

  const filtered = (jobs ?? []).filter((j) => filter === 'all' || j.status === filter);

  if (!canView) {
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

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Talento"
        title="Selección"
        subtitle="Ofertas abiertas, pipeline de candidatos y contrataciones."
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Nueva oferta
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-1 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`h-8 px-3 text-[12px] font-medium rounded-md transition-colors ${
              filter === f.key ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p></Card>}
      {jobs && filtered.length === 0 && (
        <Card><p className="text-[13px] text-[var(--ink-tertiary)]">No hay ofertas en este filtro.</p></Card>
      )}

      <div className="grid grid-cols-2 gap-5">
        {filtered.map((job) => (
          <Card key={job.id} className="cursor-pointer hover:border-[var(--accent)] transition-colors" >
            <div onClick={() => navigate(`/seleccion/${job.id}`)}>
              <div className="flex items-start justify-between mb-2">
                <div className="text-[11px] text-[var(--ink-tertiary)] uppercase tracking-wider">
                  {job.department?.name ?? 'Sin departamento'}
                </div>
                <JobStatusBadge status={job.status} />
              </div>
              <h3 className="font-serif text-[18px] font-medium mb-1">{job.title}</h3>
              <div className="flex items-center gap-3 text-[12px] text-[var(--ink-secondary)] mb-4">
                <span>{job.location}{job.remote ? ' (remoto)' : ''}</span>
                <span>·</span>
                <span>{job.level}</span>
                <span>·</span>
                <span>{job.openings} {job.openings === 1 ? 'apertura' : 'aperturas'}</span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {Object.entries(job.byStage).length === 0 && (
                  <span className="text-[12px] text-[var(--ink-tertiary)]">Sin candidaturas todavía.</span>
                )}
                {Object.entries(job.byStage).map(([stage, count]) => (
                  <Badge key={stage} variant="neutral">
                    {stage}: {count}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[var(--line-subtle)]">
                {job.hiringManager ? (
                  <div className="flex items-center gap-2">
                    <Avatar name={job.hiringManager.fullName} size="xs" />
                    <span className="text-[12px] text-[var(--ink-secondary)]">{job.hiringManager.fullName}</span>
                  </div>
                ) : (
                  <span className="text-[12px] text-[var(--ink-tertiary)]">Sin hiring manager</span>
                )}
                <span className="mono text-[12px] font-medium">{job.totalApplications} candidaturas</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {creating && <NuevaOfertaModal onClose={() => setCreating(false)} />}
    </div>
  );
}
