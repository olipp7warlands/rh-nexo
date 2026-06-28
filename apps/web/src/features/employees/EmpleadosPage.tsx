import { useState } from 'react';
import { Avatar, Badge, Button, Card, DeptChip, EmpStatus, Input, PageHeader } from '@nucleo/ui';
import { useEmployees } from './useEmployees';

/**
 * Página de referencia: lista real desde la API con búsqueda.
 * Demuestra el patrón de datos + componentes "Clear".
 * El resto (ficha con 7 pestañas, modal de Editar usando useUpdateEmployee,
 * alta) se construye en la Fase 1 siguiendo este mismo patrón y el mockup.
 */
export function EmpleadosPage() {
  const [search, setSearch] = useState('');
  const { data: employees, isLoading, error } = useEmployees({ search });

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        title="Empleados"
        subtitle={employees ? `${employees.length} personas en el grupo` : 'Cargando…'}
        actions={<Button variant="primary">Añadir empleado</Button>}
      />

      <div className="max-w-md mb-5">
        <Input placeholder="Nombre o puesto…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <Card><p className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p></Card>}
      {isLoading && <Card><p className="text-[var(--ink-tertiary)] text-[13px]">Cargando empleados…</p></Card>}

      {employees && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Empleado', 'Departamento', 'Manager', 'Ubicación', 'Estado'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] cursor-pointer">
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
                  <td className="px-5 py-4"><EmpStatus status={e.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
