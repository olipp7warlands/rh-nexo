import { useState } from 'react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useDepartments } from '../employees/useDepartments';
import { downloadFile } from '../../lib/api';
import { useReportsOverview } from './useReports';
import { formatEuro } from '../../lib/format';
import { BarList } from './charts';
import { ProcesosAnalitica } from './ProcesosAnalitica';

export function InformesPage() {
  const { user } = useAuth();
  const canView = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const { data: departments } = useDepartments();
  const { data, isLoading } = useReportsOverview(departmentId, canView);

  if (!canView) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <PageHeader eyebrow="Empresa" title="Informes" />
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            Los informes contienen datos sensibles (coste de plantilla) y solo están disponibles para RRHH y Administración.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Empresa"
        title="Informes"
        subtitle="Analítica de plantilla calculada desde datos reales."
        actions={
          <>
            <select
              value={departmentId ?? ''}
              onChange={(e) => setDepartmentId(e.target.value || undefined)}
              className="h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] focus:border-[var(--accent)] focus:outline-none"
              aria-label="Filtrar por departamento"
            >
              <option value="">Todos los departamentos</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => downloadFile(`/reports/export${departmentId ? `?departmentId=${departmentId}` : ''}`, 'informe-plantilla.csv')}
            >
              Exportar
            </Button>
          </>
        }
      />

      {isLoading && <Card><p className="text-[13px] text-[var(--ink-tertiary)]">Calculando…</p></Card>}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Plantilla activa</div>
              <div className="mono text-[28px] font-bold leading-none">{data.headcount.totalActive}</div>
              <div className="text-[11px] text-[var(--ink-tertiary)]">{data.headcount.totalAll} en total (incl. bajas)</div>
            </div>
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Rotación</div>
              <div className="mono text-[28px] font-bold leading-none">{data.rotation.rate}%</div>
              <div className="text-[11px] text-[var(--ink-tertiary)]">{data.rotation.bajas} bajas</div>
            </div>
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Absentismo</div>
              <div className="mono text-[28px] font-bold leading-none">{data.absenteeism.totalDays}</div>
              <div className="text-[11px] text-[var(--ink-tertiary)]">días aprobados</div>
            </div>
            <div className="stat-card">
              <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Coste anual</div>
              <div className="mono text-[24px] font-bold leading-none">{formatEuro(data.cost.total)}</div>
              <div className="text-[11px] text-[var(--ink-tertiary)]">bruto, plantilla activa</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-4">Plantilla por departamento</h3>
              <BarList items={data.headcount.byDept.map((d) => ({ label: d.name, value: d.count }))} />
            </Card>
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-4">Coste por departamento</h3>
              <BarList items={data.cost.byDept.map((d) => ({ label: d.name, value: d.total, display: formatEuro(d.total) }))} />
            </Card>
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-1">Distribución de desempeño</h3>
              <p className="text-[11px] text-[var(--ink-tertiary)] mb-4">{data.performance.rated} evaluaciones con valoración</p>
              <BarList items={data.performance.distribution.map((d) => ({ label: d.label, value: d.count }))} />
            </Card>
            <Card>
              <h3 className="font-serif text-[14px] font-medium mb-4">Diversidad por ubicación</h3>
              <BarList items={data.diversity.byLocation.map((l) => ({ label: l.location, value: l.count }))} />
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-4">
                Modalidad: {data.diversity.remote} en remoto · {data.diversity.onsite} presencial.
                <br />
                (El modelo no incluye datos de género; la diversidad se muestra por ubicación/modalidad.)
              </p>
            </Card>
          </div>
        </>
      )}

      <section aria-labelledby="informes-procesos" className="mt-10">
        <h2 id="informes-procesos" className="font-serif text-[18px] font-medium mb-1">Procesos de selección</h2>
        <p className="text-[12px] text-[var(--ink-tertiary)] mb-5">Analítica agregada de ofertas y candidaturas; no incluye nombres de candidatos.</p>
        <ProcesosAnalitica />
      </section>
    </div>
  );
}
