import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useJobs, type JobStatus, type JobSummary } from './useRecruitment';
import { JobStatusBadge } from './RecruitmentBadges';
import { NuevaOfertaModal } from './NuevaOfertaModal';
import { SeleccionTabs } from './SeleccionTabs';

const FILTERS: { key: JobStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'ABIERTA', label: 'Activas' },
  { key: 'PAUSADA', label: 'Pausadas' },
  { key: 'CERRADA', label: 'Cerradas' },
];

type ViewMode = 'tarjetas' | 'listado';
const VIEW_STORAGE_KEY = 'humanx:seleccion-vista';

/** Vista elegida, persistida en localStorage (como el plegado del menú lateral). El acceso al
 *  storage va en try/catch: puede lanzar o venir vacío en ventanas privadas. */
function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_STORAGE_KEY) === 'listado' ? 'listado' : 'tarjetas';
    } catch {
      return 'tarjetas';
    }
  });
  const update = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v);
    } catch {
      /* sin persistencia: la vista sigue funcionando en memoria */
    }
  };
  return [view, update];
}

type SortKey = 'title' | 'department' | 'status' | 'totalApplications' | 'openedAt';
const COLUMNS: { key: SortKey | null; label: string }[] = [
  { key: 'title', label: 'Puesto' },
  { key: 'department', label: 'Departamento' },
  { key: null, label: 'Ubicación' },
  { key: null, label: 'Nivel' },
  { key: 'status', label: 'Estado' },
  { key: null, label: 'Aperturas' },
  { key: 'totalApplications', label: 'Candidaturas' },
  { key: null, label: 'Pipeline' },
  { key: null, label: 'Hiring manager' },
  { key: 'openedAt', label: 'Apertura' },
];

function sortValue(j: JobSummary, key: SortKey): string | number {
  if (key === 'department') return j.department?.name ?? '';
  return j[key];
}

function JobsTable({ jobs }: { jobs: JobSummary[] }) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'openedAt', dir: 'desc' });

  const sorted = [...jobs].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
    return sort.dir === 'asc' ? cmp : -cmp;
  });

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <Card padding="p-0">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
            {COLUMNS.map((c) => {
              const active = c.key !== null && sort.key === c.key;
              return (
                <th
                  key={c.label}
                  scope="col"
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]"
                >
                  {c.key ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key!)}
                      className="uppercase tracking-wider hover:text-[var(--ink-primary)]"
                    >
                      {c.label}
                      {active && <span aria-hidden="true"> {sort.dir === 'asc' ? '↑' : '↓'}</span>}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((job) => (
            <tr
              key={job.id}
              onClick={() => navigate(`/seleccion/${job.id}`)}
              className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] cursor-pointer"
            >
              <td className="px-4 py-3 font-medium">
                <Link to={`/seleccion/${job.id}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                  {job.title}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--ink-secondary)]">{job.department?.name ?? '—'}</td>
              <td className="px-4 py-3 text-[var(--ink-secondary)]">
                {job.location}
                {job.remote ? ' (remoto)' : ''}
              </td>
              <td className="px-4 py-3 text-[var(--ink-secondary)]">{job.level}</td>
              <td className="px-4 py-3">
                <JobStatusBadge status={job.status} />
              </td>
              <td className="px-4 py-3 mono">{job.openings}</td>
              <td className="px-4 py-3 mono font-medium">{job.totalApplications}</td>
              <td className="px-4 py-3 text-[12px] text-[var(--ink-secondary)]">
                {Object.keys(job.byStage).length === 0
                  ? '—'
                  : Object.entries(job.byStage)
                      .map(([stage, n]) => `${stage}: ${n}`)
                      .join(' · ')}
              </td>
              <td className="px-4 py-3 text-[var(--ink-secondary)]">{job.hiringManager?.fullName ?? '—'}</td>
              <td className="px-4 py-3 mono text-[12px] text-[var(--ink-secondary)]">
                {new Date(job.openedAt).toLocaleDateString('es-ES')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function ReclutamientoPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const canView = canManage || user?.role === 'MANAGER';
  const navigate = useNavigate();
  const { data: jobs, isLoading } = useJobs(canView);
  const [filter, setFilter] = useState<JobStatus | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [view, setView] = useViewMode();

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

      {canManage && <SeleccionTabs />}

      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex gap-1">
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

        <div role="group" aria-label="Vista" className="flex rounded-md border border-[var(--line-strong)] overflow-hidden">
          {(['tarjetas', 'listado'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`h-8 px-3 text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors ${
                view === v ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span aria-hidden="true">{v === 'tarjetas' ? '▦' : '☰'}</span>
              {v === 'tarjetas' ? 'Tarjetas' : 'Listado'}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p></Card>}
      {jobs && filtered.length === 0 && (
        <Card><p className="text-[13px] text-[var(--ink-tertiary)]">No hay ofertas en este filtro.</p></Card>
      )}

      {view === 'listado' && filtered.length > 0 && <JobsTable jobs={filtered} />}

      {view === 'tarjetas' && (
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
      )}

      {creating && <NuevaOfertaModal onClose={() => setCreating(false)} />}
    </div>
  );
}
