import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Input, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useProyectos, useSociedades } from '../estructura/useEstructura';
import { formatDate } from '../../lib/format';
import { useHistorico, useJob, useJobs, type ApplicationStatus, type HistoricoItem } from './useRecruitment';
import { ApplicationStatusBadge } from './RecruitmentBadges';
import { CandidatePanel } from './CandidatePanel';
import { SeleccionTabs } from './SeleccionTabs';

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'ACTIVO', label: 'En proceso' },
  { value: 'CONTRATADO', label: 'Contratado' },
  { value: 'RECHAZADO', label: 'Descartado' },
  { value: 'RETIRADO', label: 'Retirado' },
];

const fieldClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';
const labelClass = 'block text-[11px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)] mb-1.5';

const COLUMNS = ['Nombre', 'CV', 'LinkedIn', 'Ubicación', 'Puesto', 'Sociedad', 'Proyecto', 'Postulación', 'Incorporación', 'Estado'];

/** Abre la ficha del candidato (CandidatePanel necesita la oferta de esa candidatura). */
function HistoricoCandidatePanel({ item, onClose }: { item: HistoricoItem; onClose: () => void }) {
  const { data: job } = useJob(item.jobId);
  if (!job) return null;
  return <CandidatePanel candidateId={item.candidateId} applicationId={item.applicationId} job={job} onClose={onClose} />;
}

export function HistoricoPage() {
  const { user } = useAuth();
  const canView = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<HistoricoItem | null>(null);

  // Filtros en la query string (compartibles y sobreviven a recargas). Nombres = lo visible.
  const q = params.get('q') ?? '';
  const jobId = params.get('puesto') ?? '';
  const sociedadId = params.get('sociedad') ?? '';
  const proyectoId = params.get('proyecto') ?? '';
  const location = params.get('ubicacion') ?? '';
  const status = (params.get('estado') ?? '') as ApplicationStatus | '';
  const from = params.get('desde') ?? '';
  const to = params.get('hasta') ?? '';
  const page = Math.max(1, Number(params.get('pagina') ?? '1') || 1);

  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'pagina') next.delete('pagina');
        return next;
      },
      { replace: true },
    );

  // El buscador escribe en la URL con un pequeño retardo: cada consulta queda auditada en el
  // servidor y no debe dispararse en cada pulsación.
  const [qInput, setQInput] = useState(q);
  useEffect(() => setQInput(q), [q]);
  useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => setParam('q', qInput.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  // La ubicación (texto libre) también se escribe en la URL con retardo, igual que el nombre.
  const [locInput, setLocInput] = useState(location);
  useEffect(() => setLocInput(location), [location]);
  useEffect(() => {
    if (locInput === location) return;
    const t = setTimeout(() => setParam('ubicacion', locInput.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locInput]);

  const { data: jobs } = useJobs(canView);
  const { data: sociedades } = useSociedades();
  const { data: proyectos } = useProyectos();
  const { data, isLoading, isError, error, isFetching } = useHistorico(
    {
      q: q || undefined,
      jobId: jobId || undefined,
      sociedadId: sociedadId || undefined,
      proyectoId: proyectoId || undefined,
      location: location || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    canView,
  );

  const hasFilters = !!(q || jobId || sociedadId || proyectoId || location || status || from || to);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  if (!canView) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <PageHeader eyebrow="Talento" title="Selección" />
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            El histórico de candidatos contiene datos personales de terceros y solo está disponible para RRHH y
            Administración.
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
        subtitle="Histórico de personas que han pasado por cualquier proceso de selección."
      />
      <SeleccionTabs />

      <form
        role="search"
        aria-label="Filtros del histórico"
        onSubmit={(e) => e.preventDefault()}
        className="grid grid-cols-6 gap-4 mb-3"
      >
        <div className="col-span-2">
          <label htmlFor="hist-q" className={labelClass}>
            Nombre
          </label>
          <Input id="hist-q" type="search" placeholder="Buscar por nombre…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </div>
        <div>
          <label htmlFor="hist-puesto" className={labelClass}>
            Puesto
          </label>
          <select id="hist-puesto" className={fieldClass} value={jobId} onChange={(e) => setParam('puesto', e.target.value)}>
            <option value="">Todos</option>
            {jobs?.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hist-sociedad" className={labelClass}>
            Sociedad
          </label>
          <select id="hist-sociedad" className={fieldClass} value={sociedadId} onChange={(e) => setParam('sociedad', e.target.value)}>
            <option value="">Todas</option>
            {sociedades?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hist-estado" className={labelClass}>
            Estado
          </label>
          <select id="hist-estado" className={fieldClass} value={status} onChange={(e) => setParam('estado', e.target.value)}>
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="hist-desde" className={labelClass}>
              Desde
            </label>
            <input id="hist-desde" type="date" className={fieldClass} value={from} max={to || undefined} onChange={(e) => setParam('desde', e.target.value)} />
          </div>
          <div>
            <label htmlFor="hist-hasta" className={labelClass}>
              Hasta
            </label>
            <input id="hist-hasta" type="date" className={fieldClass} value={to} min={from || undefined} onChange={(e) => setParam('hasta', e.target.value)} />
          </div>
        </div>
        <div className="col-span-2">
          <label htmlFor="hist-ubicacion" className={labelClass}>
            Ubicación del candidato
          </label>
          <Input id="hist-ubicacion" type="search" placeholder="Ciudad o país…" value={locInput} onChange={(e) => setLocInput(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label htmlFor="hist-proyecto" className={labelClass}>
            Proyecto
          </label>
          <select id="hist-proyecto" className={fieldClass} value={proyectoId} onChange={(e) => setParam('proyecto', e.target.value)}>
            <option value="">Todos</option>
            {proyectos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </form>

      <div className="flex items-center justify-between mb-4 min-h-8">
        <p role="status" aria-live="polite" className="text-[12px] text-[var(--ink-secondary)]">
          {data ? `${data.total} ${data.total === 1 ? 'candidatura' : 'candidaturas'}` : isLoading ? 'Cargando…' : ''}
          {isFetching && data ? ' · actualizando…' : ''}
        </p>
        {hasFilters && (
          <Button variant="ghost" type="button" onClick={() => setParams({}, { replace: true })}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {isError && (
        <div role="alert" className="text-[13px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-4 py-3 mb-4">
          No se pudo cargar el histórico: {(error as Error).message}
        </div>
      )}

      {data && data.items.length === 0 && (
        <Card>
          <p className="text-[13px] text-[var(--ink-tertiary)]">
            {hasFilters ? 'Ninguna candidatura coincide con estos filtros.' : 'Todavía no hay candidaturas registradas.'}
          </p>
        </Card>
      )}

      {data && data.items.length > 0 && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Histórico de candidaturas, una fila por candidatura</caption>
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {COLUMNS.map((c) => (
                  <th key={c} scope="col" className="text-left px-4 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((it) => (
                <tr key={it.applicationId} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                  <td className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => setSelected(it)}
                      aria-label={`Abrir la ficha de ${it.fullName} (${it.jobTitle})`}
                      className="text-left hover:underline"
                    >
                      {it.fullName}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {it.resumeUrl ? (
                      <a href={it.resumeUrl} target="_blank" rel="noreferrer" aria-label={`CV de ${it.fullName} (abre en otra pestaña)`} className="hover:underline">
                        CV ↗
                      </a>
                    ) : (
                      <span className="text-[var(--ink-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {it.linkedinUrl ? (
                      <a href={it.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`LinkedIn de ${it.fullName} (abre en otra pestaña)`} className="hover:underline">
                        LinkedIn ↗
                      </a>
                    ) : (
                      <span className="text-[var(--ink-tertiary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-secondary)]">{it.location ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Link to={`/seleccion/${it.jobId}`} className="hover:underline">
                      {it.jobTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-secondary)]">{it.sociedad?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-[var(--ink-secondary)]">{it.proyecto?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 mono text-[12px] text-[var(--ink-secondary)]">{formatDate(it.appliedAt)}</td>
                  <td className="px-4 py-3 mono text-[12px] text-[var(--ink-secondary)]">
                    {it.fechaIncorporacion ? formatDate(it.fechaIncorporacion) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ApplicationStatusBadge status={it.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {data && totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between mt-4">
          <Button variant="secondary" type="button" disabled={page <= 1} onClick={() => setParam('pagina', String(page - 1))}>
            Anterior
          </Button>
          <span className="text-[12px] text-[var(--ink-secondary)] mono">
            Página {page} de {totalPages}
          </span>
          <Button variant="secondary" type="button" disabled={page >= totalPages} onClick={() => setParam('pagina', String(page + 1))}>
            Siguiente
          </Button>
        </nav>
      )}

      {selected && <HistoricoCandidatePanel item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
