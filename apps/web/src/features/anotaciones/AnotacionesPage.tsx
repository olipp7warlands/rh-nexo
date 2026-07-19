import { useState } from 'react';
import { Avatar, Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useEmployees } from '../employees/useEmployees';
import { formatDate } from '../../lib/format';
import {
  useAnotaciones,
  useCategorias,
  useDeleteAnotacion,
  useMarcarHecha,
  useReabrir,
  type Anotacion,
  type EstadoAnotacion,
} from './useAnotaciones';
import { AnotacionModal } from './AnotacionModal';

const selectClass =
  'h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

function CategoriaChip({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium"
      style={{ background: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {nombre}
    </span>
  );
}

function AnotacionCard({ anotacion, onEdit }: { anotacion: Anotacion; onEdit: () => void }) {
  const marcarHecha = useMarcarHecha();
  const reabrir = useReabrir();
  const remove = useDeleteAnotacion();
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!window.confirm('¿Eliminar esta anotación?')) return;
    setError(null);
    try {
      await remove.mutateAsync(anotacion.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Avatar name={anotacion.empleado.fullName} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-medium">{anotacion.empleado.fullName}</span>
              {anotacion.empleado.sociedad && (
                <span className="text-[11px] text-[var(--ink-tertiary)]">· {anotacion.empleado.sociedad.nombre}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {anotacion.categoria && <CategoriaChip nombre={anotacion.categoria.nombre} color={anotacion.categoria.color} />}
              <span className="mono text-[11px] text-[var(--ink-tertiary)]">{formatDate(anotacion.fecha)}</span>
            </div>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium ${
            anotacion.estado === 'HECHA' ? 'bg-[var(--bg-subtle)] text-[var(--ink-primary)]' : 'bg-[var(--bg-subtle)] text-[var(--ink-secondary)]'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${anotacion.estado === 'HECHA' ? 'bg-[var(--ink-primary)]' : 'bg-transparent border-[1.5px] border-[var(--ink-primary)]'}`}
          />
          {anotacion.estado === 'HECHA' ? 'Hecha' : 'Pendiente'}
        </span>
      </div>

      <p className="text-[13px] text-[var(--ink-primary)] mt-3 whitespace-pre-wrap">{anotacion.texto}</p>

      {error && <p className="text-[12px] text-[var(--danger)] mt-2">{error}</p>}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--line-subtle)]">
        {anotacion.estado === 'PENDIENTE' ? (
          <button
            onClick={() => marcarHecha.mutate(anotacion.id)}
            disabled={marcarHecha.isPending}
            className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline"
          >
            Marcar hecha
          </button>
        ) : (
          <button
            onClick={() => reabrir.mutate(anotacion.id)}
            disabled={reabrir.isPending}
            className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline"
          >
            Reabrir
          </button>
        )}
        <span className="text-[var(--line-strong)]">·</span>
        <button onClick={onEdit} className="text-[12px] font-medium text-[var(--ink-secondary)] hover:underline">
          Editar
        </button>
        <span className="text-[var(--line-strong)]">·</span>
        <button
          onClick={onDelete}
          disabled={remove.isPending}
          className="text-[12px] font-medium text-[var(--ink-secondary)] hover:text-[var(--danger)] hover:underline"
        >
          Eliminar
        </button>
      </div>
    </Card>
  );
}

export function AnotacionesPage() {
  const { user } = useAuth();
  const canView = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const [empleadoId, setEmpleadoId] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoAnotacion | undefined>(undefined);
  const [categoriaId, setCategoriaId] = useState<string | undefined>(undefined);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Anotacion | null>(null);

  const { data: employees } = useEmployees({});
  const { data: categorias } = useCategorias(canView);
  const { data: anotaciones, isLoading, error } = useAnotaciones({ empleadoId, estado, categoriaId, desde, hasta }, canView);
  const { data: allAnotaciones } = useAnotaciones({}, canView);

  if (!canView) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <PageHeader eyebrow="Principal" title="Anotaciones" />
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">
            La Memoria contiene notas internas sobre personas y solo está disponible para RRHH y Administración.
          </p>
        </Card>
      </div>
    );
  }

  const countFor = (catId: string) => (allAnotaciones ?? []).filter((a) => a.categoriaId === catId).length;

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Principal"
        title="Anotaciones"
        subtitle={anotaciones ? `${anotaciones.length} anotaciones` : 'Memoria global de personas.'}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Nueva anotación
          </Button>
        }
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select className={selectClass} value={empleadoId ?? ''} onChange={(e) => setEmpleadoId(e.target.value || undefined)} aria-label="Filtrar por persona">
          <option value="">Todas las personas</option>
          {employees?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
        <select className={selectClass} value={estado ?? ''} onChange={(e) => setEstado((e.target.value || undefined) as EstadoAnotacion | undefined)} aria-label="Filtrar por estado">
          <option value="">Pendientes y hechas</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="HECHA">Hechas</option>
        </select>
        <input type="date" className={selectClass} value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <span className="text-[12px] text-[var(--ink-tertiary)]">—</span>
        <input type="date" className={selectClass} value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
      </div>

      {/* Chips de categoría con conteo */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCategoriaId(undefined)}
          className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors ${
            !categoriaId ? 'bg-[var(--ink-primary)] text-white' : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          Todas
        </button>
        {categorias?.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoriaId(c.id)}
            className={`h-7 px-3 rounded-md text-[12px] font-medium transition-colors inline-flex items-center gap-1.5 ${
              categoriaId === c.id ? 'bg-[var(--ink-primary)] text-white' : 'hover:bg-[var(--bg-hover)]'
            }`}
            style={categoriaId === c.id ? undefined : { color: c.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: categoriaId === c.id ? '#fff' : c.color }} />
            {c.nombre}
            <span className={categoriaId === c.id ? 'text-white/70' : 'text-[var(--ink-tertiary)]'}>{countFor(c.id)}</span>
          </button>
        ))}
      </div>

      {error && (
        <Card>
          <p className="text-[13px] text-[var(--danger)]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {isLoading && (
        <Card>
          <p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        {anotaciones?.map((a) => (
          <AnotacionCard key={a.id} anotacion={a} onEdit={() => setEditing(a)} />
        ))}
        {anotaciones && anotaciones.length === 0 && (
          <Card>
            <p className="text-[13px] text-[var(--ink-tertiary)] text-center py-6">No hay anotaciones con estos filtros.</p>
          </Card>
        )}
      </div>

      {creating && <AnotacionModal mode="create" onClose={() => setCreating(false)} />}
      {editing && <AnotacionModal mode="edit" anotacion={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
