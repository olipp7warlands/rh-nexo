import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useSociedades, useDeleteSociedad, type Sociedad } from './useEstructura';
import { SociedadModal } from './SociedadModal';

export function SociedadesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const { data: sociedades, isLoading, error } = useSociedades();
  const remove = useDeleteSociedad();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Sociedad | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDelete = async (s: Sociedad) => {
    if (!window.confirm(`¿Eliminar la sociedad "${s.nombre}"?`)) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(s.id);
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Estructura"
        title="Sociedades"
        subtitle={sociedades ? `${sociedades.length} sociedades del grupo` : 'Cargando…'}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Añadir sociedad
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
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando sociedades…</p>
        </Card>
      )}

      {sociedades && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Sociedad', 'País', 'Personas', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sociedades.map((s) => (
                <tr key={s.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                  <td className="px-5 py-4 font-medium">{s.nombre}</td>
                  <td className="px-5 py-4 text-[var(--ink-secondary)]">{s.pais.nombre}</td>
                  <td className="px-5 py-4 mono text-[var(--ink-secondary)]">{s._count.empleados}</td>
                  <td className="px-5 py-4">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(s)}
                          aria-label={`Editar ${s.nombre}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(s)}
                          disabled={remove.isPending}
                          aria-label={`Eliminar ${s.nombre}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {sociedades.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    No hay sociedades todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {creating && <SociedadModal mode="create" onClose={() => setCreating(false)} />}
      {editing && <SociedadModal mode="edit" sociedad={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
