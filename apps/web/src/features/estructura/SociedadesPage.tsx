import { useState } from 'react';
import { Button, Card } from '@nucleo/ui';
import { FilaAcciones, razonEnUso } from '../_shared/AccionesMenu';
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


  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-[var(--ink-tertiary)]">{sociedades ? `${sociedades.length} sociedades del grupo` : 'Cargando…'}</p>
        {canManage && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Añadir sociedad
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
                      <FilaAcciones
                        label={`Acciones de la sociedad ${s.nombre}`}
                        onEdit={() => setEditing(s)}
                        eliminar={{
                          title: 'Eliminar la sociedad',
                          message: `¿Eliminar la sociedad «${s.nombre}»? Esta acción no se puede deshacer.`,
                          disabledReason: razonEnUso([[s._count.empleados, 'persona', 'personas'], [s._count.jobs, 'oferta', 'ofertas'], [s._count.registrosPuesto, 'registro de puesto', 'registros de puesto']]),
                          onConfirm: () => remove.mutateAsync(s.id),
                        }}
                      />
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
