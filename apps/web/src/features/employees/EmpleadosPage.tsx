import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, Button, Card, DeptChip, EmpStatus, Input, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useEmployees, type EmployeeStatus } from './useEmployees';
import { useDepartments } from './useDepartments';
import { EmployeeModal } from './EmployeeModal';
import { seniority } from '../../lib/format';

const STATUS_KPIS: { key: EmployeeStatus | 'REMOTO'; label: string; dot: string }[] = [
  { key: 'ACTIVO', label: 'Activos', dot: 'var(--success)' },
  { key: 'ONBOARDING', label: 'En onboarding', dot: 'var(--info)' },
  { key: 'AUSENTE', label: 'Ausentes', dot: 'var(--warning)' },
  { key: 'REMOTO', label: 'En remoto', dot: '#8B5CF6' },
];

export function EmpleadosPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<EmployeeStatus | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  const { data: all } = useEmployees({});
  const { data: employees, isLoading, error } = useEmployees({ search, departmentId, status });
  const { data: departments } = useDepartments();

  const kpis = useMemo(() => {
    const list = all ?? [];
    return {
      ACTIVO: list.filter((e) => e.status === 'ACTIVO').length,
      ONBOARDING: list.filter((e) => e.status === 'ONBOARDING').length,
      AUSENTE: list.filter((e) => e.status === 'AUSENTE').length,
      REMOTO: list.filter((e) => e.remote).length,
    };
  }, [all]);

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Principal"
        title="Empleados"
        subtitle={all ? `${all.length} personas en el grupo` : 'Cargando…'}
        actions={
          canCreate && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Añadir empleado
            </Button>
          )
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {STATUS_KPIS.map((k) => (
          <div key={k.key} className="stat-card">
            <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--ink-secondary)]">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: k.dot }} />
              {k.label}
            </div>
            <div className="mono text-[28px] font-bold leading-none">{kpis[k.key as keyof typeof kpis]}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="w-64">
          <Input placeholder="Nombre o puesto…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
          value={status ?? ''}
          onChange={(e) => setStatus((e.target.value || undefined) as EmployeeStatus | undefined)}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="AUSENTE">Ausente</option>
          <option value="BAJA">Baja</option>
        </select>
      </div>

      {/* Chips de departamento */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setDepartmentId(undefined)}
          className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors ${
            !departmentId ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          Todos
        </button>
        {departments?.map((d) => (
          <button
            key={d.id}
            onClick={() => setDepartmentId(d.id)}
            className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors ${
              departmentId === d.id ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {d.name}
          </button>
        ))}
      </div>

      {error && (
        <Card>
          <p className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {isLoading && (
        <Card>
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando empleados…</p>
        </Card>
      )}

      {employees && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Empleado', 'Departamento', 'Manager', 'Ubicación', 'Antigüedad', 'Estado'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => navigate(`/empleados/${e.id}`)}
                  className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.fullName} size="sm" />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {e.fullName}
                          {e.remote && <Badge variant="neutral">remoto</Badge>}
                        </div>
                        <div className="text-[11px] text-[var(--ink-tertiary)]">{e.jobTitle}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">{e.department && <DeptChip name={e.department.name} color={e.department.color} />}</td>
                  <td className="px-5 py-4 text-[12px] text-[var(--ink-secondary)]">{e.manager?.fullName ?? '—'}</td>
                  <td className="px-5 py-4 text-[12px] text-[var(--ink-secondary)]">{e.location}</td>
                  <td className="px-5 py-4 text-[12px] text-[var(--ink-secondary)]">{seniority(e.startDate)}</td>
                  <td className="px-5 py-4">
                    <EmpStatus status={e.status} />
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    No hay empleados con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {creating && <EmployeeModal mode="create" allEmployees={all ?? []} onClose={() => setCreating(false)} />}
    </div>
  );
}
