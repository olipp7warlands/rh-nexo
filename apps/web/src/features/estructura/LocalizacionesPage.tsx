import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useLocalizaciones, useDeleteLocalizacion, type Localizacion } from './useEstructura';
import { LocalizacionModal } from './LocalizacionModal';

export function LocalizacionesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const { data: localizaciones, isLoading, error } = useLocalizaciones();
  const remove = useDeleteLocalizacion();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Localizacion | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDelete = async (l: Localizacion) => {
    if (!window.confirm(`¿Eliminar la localización "${l.nombre}"?`)) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(l.id);
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Estructura"
        title="Localizaciones"
        subtitle={localizaciones ? `${localizaciones.length} localizaciones` : 'Cargando…'}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Añadir localización
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
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando localizaciones…</p>
        </Card>
      )}

      {localizaciones && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Localización', 'Personas', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {localizaciones.map((l) => (
                <tr key={l.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                  <td className="px-5 py-4 font-medium">{l.nombre}</td>
                  <td className="px-5 py-4 mono text-[var(--ink-secondary)]">{l._count.empleados}</td>
                  <td className="px-5 py-4">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(l)}
                          aria-label={`Editar ${l.nombre}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(l)}
                          disabled={remove.isPending}
                          aria-label={`Eliminar ${l.nombre}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {localizaciones.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    No hay localizaciones todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {creating && <LocalizacionModal mode="create" onClose={() => setCreating(false)} />}
      {editing && <LocalizacionModal mode="edit" localizacion={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
