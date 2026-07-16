import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Card, DeptChip, PageHeader } from '@nucleo/ui';
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
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDelete = async (d: DepartmentWithMeta) => {
    if (!window.confirm(`¿Eliminar el departamento "${d.name}"?`)) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(d.id);
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Estructura"
        title="Departamentos"
        subtitle={departments ? `${departments.length} departamentos` : 'Cargando…'}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Añadir departamento
            </Button>
          )
        }
      />

      {error && (
        <Card>
          <p className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {deleteError && (
        <Card className="mb-4">
          <p role="alert" className="text-[var(--danger)] text-[13px]">
            {deleteError}
          </p>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(d)}
                          aria-label={`Editar ${d.name}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(d)}
                          disabled={remove.isPending}
                          aria-label={`Eliminar ${d.name}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
