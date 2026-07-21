import { useEffect, useState } from 'react';
import { Button, Card, KPICard, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { downloadFile, viewFile } from '../../lib/api';
import { formatEuro } from '../../lib/format';
import {
  usePayrollRuns,
  usePayrollRun,
  useMyPayslips,
  useProcessRun,
  PAYROLL_ITEM_TYPE_LABEL,
  type PayrollItemType,
} from './usePayroll';
import { PayrollRunStatusBadge, PayslipStatusBadge } from './PayrollBadges';
import { NuevaNominaModal } from './NuevaNominaModal';
import { NuevaIncidenciaModal } from './NuevaIncidenciaModal';

const TABS = [
  { k: 'resumen', l: 'Resumen' },
  { k: 'nominas', l: 'Nóminas' },
  { k: 'incidencias', l: 'Incidencias' },
] as const;

function ManagerView() {
  const { data: runs, isLoading } = usePayrollRuns();
  const [selectedId, setSelectedId] = useState('');
  const [tab, setTab] = useState<(typeof TABS)[number]['k']>('resumen');
  const [generating, setGenerating] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const process = useProcessRun();

  useEffect(() => {
    if (!selectedId && runs && runs[0]) setSelectedId(runs[0].id);
  }, [runs, selectedId]);

  const { data: run } = usePayrollRun(selectedId);
  const sorted = [...(runs ?? [])].sort((a, b) => (a.period < b.period ? -1 : 1));
  const runIdx = sorted.findIndex((r) => r.id === selectedId);
  const previous = runIdx > 0 ? sorted[runIdx - 1] : undefined;
  const variacion = previous && previous.totalCost > 0
    ? ((run?.totalCost ?? 0) - previous.totalCost) / previous.totalCost
    : null;

  const pendientes = run?.payslips.filter((p) => p.status === 'BORRADOR').length ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Empresa"
        title="Nómina"
        subtitle="Genera, procesa y exporta la nómina mensual del grupo."
        actions={
          <>
            {run && (
              <Button variant="secondary" onClick={() => downloadFile(`/payroll/runs/${run.id}/export`, `nomina-${run.period}.csv`)}>
                Exportar a gestoría
              </Button>
            )}
            {run && run.status === 'BORRADOR' && (
              <Button variant="primary" onClick={() => process.mutate(run.id)} disabled={process.isPending}>
                {process.isPending ? 'Procesando…' : 'Procesar nómina'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setGenerating(true)}>
              Generar nómina
            </Button>
          </>
        }
      />

      {isLoading && <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p></Card>}
      {runs && runs.length === 0 && (
        <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Aún no hay ninguna nómina generada.</p></Card>
      )}

      {runs && runs.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <label className="text-[12px] font-medium text-[var(--ink-secondary)]">Periodo</label>
          <select
            className="h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px]"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.period}
              </option>
            ))}
          </select>
          {run && <PayrollRunStatusBadge status={run.status} />}
        </div>
      )}

      {run && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <KPICard primary label="Coste total del mes" value={formatEuro(run.totalCost)} meta="bruto + SS empresa" />
            <KPICard label="Nóminas a procesar" value={String(pendientes)} meta="en borrador" />
            <KPICard
              label="Coste medio"
              value={run.payslips.length ? formatEuro(Math.round(run.totalCost / run.payslips.length)) : '—'}
              meta="por empleado"
            />
            <KPICard
              label="Variación"
              value={variacion === null ? '—' : `${variacion >= 0 ? '+' : ''}${(variacion * 100).toFixed(1)}%`}
              meta={previous ? `vs. ${previous.period}` : 'Primer periodo'}
            />
          </div>

          <div className="flex items-center gap-1 mb-6 border-b border-[var(--line)]">
            {TABS.map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`px-4 py-2.5 text-[13px] font-medium relative ${
                  tab === t.k ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
                }`}
              >
                {t.l}
                {t.k === 'incidencias' && <span className="ml-1.5 mono text-[11px] text-[var(--ink-tertiary)]">{run.items.length}</span>}
                {tab === t.k && <span className="absolute bottom-[-1px] left-2 right-2 h-[2px] bg-[var(--accent)]" />}
              </button>
            ))}
          </div>

          {tab === 'resumen' && (
            <Card>
              <h3 className="font-serif text-[15px] font-medium mb-4">Desglose del periodo</h3>
              <div className="space-y-3 text-[13px] max-w-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Salario bruto</span>
                  <span className="mono font-medium">{formatEuro(run.totalGross)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">SS empresa</span>
                  <span className="mono font-medium">{formatEuro(run.totalCost - run.totalGross)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[var(--line-subtle)]">
                  <span className="font-semibold">Coste total</span>
                  <span className="mono font-bold">{formatEuro(run.totalCost)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-[var(--line-subtle)]">
                  <span className="text-[var(--ink-secondary)]">Retenciones IRPF</span>
                  <span className="mono">{formatEuro(run.payslips.reduce((s, p) => s + p.irpf, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-secondary)]">Cotización trabajador</span>
                  <span className="mono">{formatEuro(run.payslips.reduce((s, p) => s + p.ss, 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Neto a pagar</span>
                  <span className="mono font-bold text-[var(--success)]">{formatEuro(run.payslips.reduce((s, p) => s + p.net, 0))}</span>
                </div>
              </div>
            </Card>
          )}

          {tab === 'nominas' && (
            <Card padding="p-0">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Empleado</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Bruto</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">IRPF</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">SS</th>
                    <th className="text-right px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Neto</th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {run.payslips.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                      <td className="px-5 py-3">
                        <div className="font-medium">{p.employee.fullName}</div>
                        <div className="text-[11px] text-[var(--ink-tertiary)]">{p.employee.jobTitle}</div>
                      </td>
                      <td className="px-4 py-3 text-right mono">{formatEuro(p.gross)}</td>
                      <td className="px-4 py-3 text-right mono text-[var(--ink-tertiary)]">− {formatEuro(p.irpf)}</td>
                      <td className="px-4 py-3 text-right mono text-[var(--ink-tertiary)]">− {formatEuro(p.ss)}</td>
                      <td className="px-5 py-3 text-right mono font-semibold">{formatEuro(p.net)}</td>
                      <td className="px-5 py-3">
                        <PayslipStatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {tab === 'incidencias' && (
            <Card padding="p-0">
              <div className="px-6 pt-5 pb-3 border-b border-[var(--line-subtle)] flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-[15px] font-medium">Incidencias del periodo</h3>
                  <p className="text-[12px] text-[var(--ink-tertiary)] mt-0.5">Variables que afectan a la nómina de {run.period}</p>
                </div>
                {run.status === 'BORRADOR' && (
                  <Button variant="secondary" onClick={() => setAddingItem(true)}>
                    + Añadir incidencia
                  </Button>
                )}
              </div>
              {run.items.length === 0 ? (
                <p className="px-6 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">Sin incidencias este periodo.</p>
              ) : (
                <div className="divide-y divide-[var(--line-subtle)]">
                  {run.items.map((inc) => {
                    const pos = inc.amount >= 0;
                    return (
                      <div key={inc.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="font-medium text-[13px]">{inc.employee.fullName}</div>
                          <div className="text-[11px] text-[var(--ink-tertiary)]">{inc.concept}</div>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--ink-secondary)]">
                          {PAYROLL_ITEM_TYPE_LABEL[inc.type as PayrollItemType]}
                        </span>
                        <div className={`mono text-[14px] font-semibold w-24 text-right ${pos ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          {pos ? '+' : ''}
                          {formatEuro(inc.amount)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {generating && <NuevaNominaModal onClose={() => setGenerating(false)} onCreated={setSelectedId} />}
      {addingItem && run && <NuevaIncidenciaModal runId={run.id} onClose={() => setAddingItem(false)} />}
    </div>
  );
}

function EmployeeView() {
  const { data: payslips, isLoading } = useMyPayslips();

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow="Empresa" title="Mis nóminas" subtitle="Consulta y descarga tus recibos de nómina." />
      <Card padding="p-0">
        {isLoading && <p className="px-5 py-6 text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>}
        {payslips && payslips.length === 0 && (
          <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">Aún no tienes nóminas emitidas.</p>
        )}
        {payslips && payslips.length > 0 && (
          <div className="divide-y divide-[var(--line-subtle)]">
            {payslips.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1">
                  <div className="font-medium text-[13px]">{p.run.period}</div>
                  <div className="text-[11px] text-[var(--ink-tertiary)] mt-0.5">
                    Bruto {formatEuro(p.gross)} · Neto {formatEuro(p.net)}
                  </div>
                </div>
                <PayslipStatusBadge status={p.status} />
                {p.pdfUrl && (
                  <Button variant="secondary" onClick={() => viewFile(p.pdfUrl!)}>
                    Ver recibo
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function NominaPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';
  return canManage ? <ManagerView /> : <EmployeeView />;
}
