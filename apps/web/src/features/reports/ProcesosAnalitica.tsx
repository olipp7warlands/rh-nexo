import { useEffect, useState } from 'react';
import { Card } from '@nucleo/ui';
import { formatDate } from '../../lib/format';
import { useProyectos, useSociedades } from '../estructura/useEstructura';
import { BarList, inkBlueShade } from './charts';
import { useSeleccionReport, type Hito, type SeleccionReport } from './useReports';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const STATUS_LABEL: Record<string, string> = { BORRADOR: 'Borrador', ABIERTA: 'Abiertas', PAUSADA: 'Pausadas', CERRADA: 'Cerradas' };
const fieldClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';
const labelClass = 'block text-[11px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)] mb-1.5';

const dias = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('es-ES')} d`);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-card">
      <div className="text-[12px] font-medium text-[var(--ink-secondary)]">{label}</div>
      <div className="mono text-[28px] font-bold leading-none">{value}</div>
      {hint && <div className="text-[11px] text-[var(--ink-tertiary)]">{hint}</div>}
    </div>
  );
}

/** Abiertas (tono oscuro) vs cerradas (tono claro) por mes, una sola gama de azul tinta. */
function MesesChart({ year, meses, max }: { year: number; meses: SeleccionReport['porAnio'][number]['meses']; max: number }) {
  const H = 96;
  return (
    <figure aria-label={`Ofertas abiertas y cerradas por mes en ${year}`} className="m-0">
      <div className="flex items-end gap-2" style={{ height: H }}>
        {meses.map((m) => (
          <div key={m.month} className="flex-1 flex items-end justify-center gap-0.5 h-full" title={`${MESES[m.month - 1]} ${year}: ${m.abiertas} abiertas, ${m.cerradas} cerradas`}>
            <div className="w-full rounded-t-sm" style={{ height: m.abiertas ? Math.max(3, (m.abiertas / max) * H) : 0, background: inkBlueShade(1) }} />
            <div className="w-full rounded-t-sm" style={{ height: m.cerradas ? Math.max(3, (m.cerradas / max) * H) : 0, background: inkBlueShade(0) }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1.5" aria-hidden="true">
        {MESES.map((n) => (
          <span key={n} className="flex-1 text-center text-[10px] text-[var(--ink-tertiary)]">{n}</span>
        ))}
      </div>
      {/* Alternativa textual para lectores de pantalla */}
      <table className="sr-only">
        <caption>Ofertas por mes en {year}</caption>
        <thead>
          <tr><th>Mes</th><th>Abiertas</th><th>Cerradas</th></tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.month}><td>{MESES[m.month - 1]}</td><td>{m.abiertas}</td><td>{m.cerradas}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Timeline({ hitos }: { hitos: Hito[] }) {
  return (
    <ol className="relative ml-2 border-l border-[var(--line-strong)] pl-5 flex flex-col gap-3">
      {hitos.map((h, i) => (
        <li key={`${h.tipo}-${h.label}-${i}`} className="relative">
          <span aria-hidden="true" className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full" style={{ background: inkBlueShade(h.tipo === 'APERTURA' || h.tipo === 'CIERRE' ? 1 : 0.4) }} />
          <div className="text-[13px] font-medium">
            {h.label}
            {h.count !== null && <span className="mono text-[var(--ink-tertiary)] font-normal"> · {h.count}</span>}
          </div>
          <div className="text-[12px] text-[var(--ink-secondary)] mono">
            {formatDate(h.fecha)}
            {h.fechaFin && ` → ${formatDate(h.fechaFin)}`}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Analítica de procesos de selección. Un solo componente para la pestaña «Analítica» de Selección y la
 * sección de Informes: mismo endpoint (GET /reports/seleccion), sin lógica duplicada. Solo agregados;
 * el servidor no devuelve nombres de candidatos. El llamador decide el gating por rol.
 */
export function ProcesosAnalitica() {
  const [year, setYear] = useState<number | undefined>(undefined);
  const [sociedadId, setSociedadId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const { data: sociedades } = useSociedades();
  const { data: proyectos } = useProyectos();
  const { data, isLoading, isError, refetch } = useSeleccionReport({ year, sociedadId: sociedadId || undefined, proyectoId: proyectoId || undefined });

  // Años disponibles: se acumulan de las respuestas para que el selector no se vacíe al filtrar.
  const [knownYears, setKnownYears] = useState<number[]>([]);
  useEffect(() => {
    if (!data) return;
    setKnownYears((prev) => [...new Set([...prev, ...data.porAnio.map((a) => a.year)])].sort((a, b) => b - a));
  }, [data]);

  const maxMes = Math.max(1, ...(data?.porAnio.flatMap((a) => a.meses.flatMap((m) => [m.abiertas, m.cerradas])) ?? [1]));

  return (
    <div>
      <form role="search" aria-label="Filtros de la analítica de procesos" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-4 gap-4 mb-6">
        <div>
          <label htmlFor="pa-anio" className={labelClass}>Año</label>
          <select id="pa-anio" className={fieldClass} value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Todos</option>
            {knownYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pa-sociedad" className={labelClass}>Sociedad</label>
          <select id="pa-sociedad" className={fieldClass} value={sociedadId} onChange={(e) => setSociedadId(e.target.value)}>
            <option value="">Todas</option>
            {sociedades?.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pa-proyecto" className={labelClass}>Proyecto</label>
          <select id="pa-proyecto" className={fieldClass} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            <option value="">Todos</option>
            {proyectos?.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </form>

      {isLoading && <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Calculando…</p></Card>}
      {isError && (
        <Card>
          <p role="alert" className="text-[13px] text-[var(--danger)]">
            No se pudo cargar la analítica.{' '}
            <button type="button" className="underline" onClick={() => refetch()}>Reintentar</button>
          </p>
        </Card>
      )}

      {data && data.totalOfertas === 0 && (
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            No hay procesos que coincidan con estos filtros. La analítica se irá llenando a medida que se abran y cierren ofertas.
          </p>
        </Card>
      )}

      {data && data.totalOfertas > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Stat label="Ofertas" value={data.totalOfertas} hint={`${data.estadoActual.ABIERTA} abiertas ahora`} />
            <Stat label="Tiempo medio de cierre" value={dias(data.cierreGlobal.mediaDias)} hint={data.cierreGlobal.n ? `sobre ${data.cierreGlobal.n} cerradas` : 'Aún sin ofertas cerradas con fechas'} />
            <Stat label="Mediana de cierre" value={dias(data.cierreGlobal.medianaDias)} />
            <Stat label="Contratados" value={data.embudo.contratados} hint={`de ${data.embudo.totalCandidaturas} candidaturas`} />
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-1">Estado actual de las ofertas</h3>
              <p className="text-[11px] text-[var(--ink-tertiary)] mb-4">Del conjunto filtrado.</p>
              <BarList items={(['ABIERTA', 'PAUSADA', 'CERRADA', 'BORRADOR'] as const).map((s) => ({ label: STATUS_LABEL[s]!, value: data.estadoActual[s] }))} />
            </Card>
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-1">Embudo de candidaturas</h3>
              <p className="text-[11px] text-[var(--ink-tertiary)] mb-4">Por etapa final alcanzada.</p>
              {data.embudo.totalCandidaturas === 0 ? (
                <p className="text-[12px] text-[var(--ink-tertiary)]">Aún no hay candidaturas en estos procesos.</p>
              ) : (
                <>
                  <BarList items={data.embudo.porEtapa.map((e) => ({ label: e.etapa, value: e.count }))} />
                  <p className="text-[11px] text-[var(--ink-tertiary)] mt-4">
                    {data.embudo.contratados} contratados · {data.embudo.descartados} descartados · {data.embudo.retirados} retirados ·{' '}
                    {data.embudo.enProceso} en proceso
                  </p>
                </>
              )}
            </Card>
          </div>

          <h3 className="font-serif text-[14px] font-medium mb-3">Ofertas abiertas y cerradas por año</h3>
          <div className="grid grid-cols-2 gap-5 mb-3">
            {data.porAnio.map((a) => (
              <Card key={a.year}>
                <div className="flex items-baseline justify-between mb-3">
                  <h4 className="font-serif text-[16px] font-medium">{a.year}</h4>
                  <span className="text-[12px] text-[var(--ink-secondary)] mono">
                    {a.abiertas} abiertas · {a.cerradas} cerradas
                  </span>
                </div>
                <MesesChart year={a.year} meses={a.meses} max={maxMes} />
                <p className="text-[11px] text-[var(--ink-tertiary)] mt-3">
                  {a.cierre.n
                    ? `Cierre: media ${dias(a.cierre.mediaDias)} · mediana ${dias(a.cierre.medianaDias)} (${a.cierre.n} cerradas)`
                    : 'Sin ofertas cerradas con fechas este año.'}
                </p>
              </Card>
            ))}
          </div>
          <div className="flex gap-4 mb-8 text-[11px] text-[var(--ink-secondary)]" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: inkBlueShade(1) }} /> Abiertas</span>
            <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: inkBlueShade(0) }} /> Cerradas</span>
          </div>

          <h3 className="font-serif text-[14px] font-medium mb-3">Línea temporal por oferta</h3>
          <Card>
            <ul className="divide-y divide-[var(--line-subtle)]">
              {data.ofertas.map((o) => (
                <li key={o.id}>
                  <details className="group py-3">
                    <summary className="cursor-pointer list-none flex items-center gap-4 text-[13px]">
                      <span className="font-medium flex-1 min-w-0 truncate">{o.title}</span>
                      <span className="text-[var(--ink-tertiary)] text-[12px]">{[o.sociedad, o.proyecto].filter(Boolean).join(' · ')}</span>
                      <span className="mono text-[12px] text-[var(--ink-secondary)] w-[170px] text-right">
                        {formatDate(o.openedAt)} → {formatDate(o.closedAt)}
                      </span>
                      <span className="mono text-[12px] w-[60px] text-right">{dias(o.diasCierre)}</span>
                    </summary>
                    <div className="mt-4 ml-1">
                      <Timeline hitos={o.hitos} />
                      {!o.tieneHistorialEtapas && (
                        <p className="text-[11px] text-[var(--ink-tertiary)] mt-4">
                          Sin historial de etapas (proceso histórico importado): solo se muestran los hitos disponibles.
                        </p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
