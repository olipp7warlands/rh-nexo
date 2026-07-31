import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import type { Catalogo } from './useEstructura';
import { CatalogoModal } from './CatalogoModal';

// humanX Tanda 2: página genérica de crear/editar/borrar para los catálogos "id + nombre +
// _count.empleados" (TipoContrato, Jornada, RelacionEmergencia, Proyecto, Idioma) — mismo
// esqueleto que LocalizacionesPage, parametrizado por los hooks para no repetir 5 páginas
// casi idénticas.
export function CatalogoPage({
  eyebrow,
  title,
  singular,
  personasLabel = 'Personas',
  useList,
  useCreate,
  useUpdate,
  useDelete,
}: {
  eyebrow: string;
  title: string;
  singular: string;
  personasLabel?: string;
  useList: () => { data?: Catalogo[]; isLoading: boolean; error: Error | null };
  useCreate: () => { mutateAsync: (data: { nombre: string }) => Promise<Catalogo>; isPending: boolean };
  useUpdate: (id: string) => { mutateAsync: (data: { nombre: string }) => Promise<Catalogo>; isPending: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<Catalogo>; isPending: boolean };
}) {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const { data: items, isLoading, error } = useList();
  const remove = useDelete();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Catalogo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const onDelete = async (item: Catalogo) => {
    if (!window.confirm(`¿Eliminar "${item.nombre}"?`)) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(item.id);
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={items ? `${items.length} ${title.toLowerCase()}` : 'Cargando…'}
        actions={
          canManage && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Añadir {singular}
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
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando…</p>
        </Card>
      )}

      {items && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {[title, personasLabel, ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                  <td className="px-5 py-4 font-medium">{item.nombre}</td>
                  <td className="px-5 py-4 mono text-[var(--ink-secondary)]">{item._count.empleados}</td>
                  <td className="px-5 py-4">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(item)}
                          aria-label={`Editar ${item.nombre}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          disabled={remove.isPending}
                          aria-label={`Eliminar ${item.nombre}`}
                          className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    Todavía no hay ninguno.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {creating && <CatalogoModal singular={singular} useCreate={useCreate} useUpdate={useUpdate} onClose={() => setCreating(false)} />}
      {editing && (
        <CatalogoModal singular={singular} item={editing} useCreate={useCreate} useUpdate={useUpdate} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
