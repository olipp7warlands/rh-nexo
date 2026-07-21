import { useState } from 'react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useDepartments } from '../employees/useDepartments';
import { downloadFile } from '../../lib/api';
import { useReportsOverview } from './useReports';
import { formatEuro } from '../../lib/format';

// Única gama cromática permitida en Informes: azul tinta apagado, en degradado según el
// valor (más oscuro = mayor). No es un color de marca — es la codificación del propio dato.
const INK_BLUE_LIGHT = { r: 199, g: 207, b: 218 }; // tinte más pálido, valores bajos
const INK_BLUE_DARK = { r: 58, g: 74, b: 99 }; // #3A4A63, valor máximo de cada gráfico
function inkBlueShade(ratio: number): string {
  const t = 0.25 + 0.75 * Math.max(0, Math.min(1, ratio)); // suelo del 25% para que nada quede casi blanco
  const lerp = (light: number, dark: number) => Math.round(light + (dark - light) * t);
  return `rgb(${lerp(INK_BLUE_LIGHT.r, INK_BLUE_DARK.r)}, ${lerp(INK_BLUE_LIGHT.g, INK_BLUE_DARK.g)}, ${lerp(INK_BLUE_LIGHT.b, INK_BLUE_DARK.b)})`;
}

function BarList({ items }: { items: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-[var(--ink-secondary)]">{i.label}</span>
            <span className="mono font-medium">{i.display ?? i.value}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: inkBlueShade(i.value / max) }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-[12px] text-[var(--ink-tertiary)]">Sin datos.</p>}
    </div>
  );
}

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
    </div>
  );
}
