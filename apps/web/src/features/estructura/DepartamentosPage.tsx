import { useState } from 'react';
import { Button, Card, DeptChip } from '@nucleo/ui';
import { FilaAcciones, razonEnUso } from '../_shared/AccionesMenu';
import { useAuth } from '../auth/AuthContext';
import { useDepartments, useDeleteDepartment, type DepartmentWithMeta } from '../employees/useDepartments';
import { DepartmentModal } from './DepartmentModal';

export function DepartamentosPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const { data: departments, isLoading, error } = useDepartments();
  const remove = useDeleteDepartment();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DepartmentWithMeta | null>(null);


  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-[var(--ink-tertiary)]">{departments ? `${departments.length} departamentos` : 'Cargando…'}</p>
        {canManage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Añadir departamento
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <p className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {isLoading && (
        <Card>
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando departamentos…</p>
        </Card>
      )}

      {departments && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Departamento', 'Responsable', 'Personas', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                  <td className="px-5 py-4">
                    <DeptChip name={d.name} color={d.color} />
                  </td>
                  <td className="px-5 py-4 text-[var(--ink-secondary)]">{d.lead?.fullName ?? '—'}</td>
                  <td className="px-5 py-4 mono text-[var(--ink-secondary)]">{d._count.members}</td>
                  <td className="px-5 py-4">
                    {canManage && (
                      <FilaAcciones
                        label={`Acciones de el departamento ${d.name}`}
                        onEdit={() => setEditing(d)}
                        eliminar={{
                          title: 'Eliminar el departamento',
                          message: `¿Eliminar el departamento «${d.name}»? Esta acción no se puede deshacer.`,
                          disabledReason: razonEnUso([[d._count.members, 'persona', 'personas'], [d._count.jobs, 'oferta', 'ofertas']]),
                          onConfirm: () => remove.mutateAsync(d.id),
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    No hay departamentos todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {creating && <DepartmentModal mode="create" onClose={() => setCreating(false)} />}
      {editing && <DepartmentModal mode="edit" department={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
