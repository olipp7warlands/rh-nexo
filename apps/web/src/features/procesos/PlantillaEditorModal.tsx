import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import {
  useCreatePlantilla,
  useCreatePlantillaTarea,
  useDeletePlantillaTarea,
  useDuplicarPlantilla,
  usePlantillas,
  useUpdatePlantilla,
  useUpdatePlantillaTarea,
  type Plantilla,
  type PlantillaTarea,
  type TipoProceso,
} from './useProcesos';

const inputClass =
  'h-8 px-2 bg-transparent border border-transparent rounded text-[12px] hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:bg-[var(--bg-surface)] focus:outline-none transition-all w-full';

function TareaRow({ tarea }: { tarea: PlantillaTarea }) {
  const update = useUpdatePlantillaTarea();
  const remove = useDeletePlantillaTarea();
  const [label, setLabel] = useState(tarea.label);
  const [fase, setFase] = useState(tarea.fase);
  const [responsable, setResponsable] = useState(tarea.responsable);

  const saveIfChanged = (field: 'label' | 'fase' | 'responsable', value: string) => {
    if (value.trim() && value !== tarea[field]) update.mutate({ tareaId: tarea.id, [field]: value });
  };

  return (
    <div className="grid grid-cols-[1fr_140px_120px_32px] gap-2 items-center py-1">
      <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => saveIfChanged('label', label)} aria-label="Tarea" />
      <input className={inputClass} value={fase} onChange={(e) => setFase(e.target.value)} onBlur={() => saveIfChanged('fase', fase)} aria-label="Fase" />
      <input className={inputClass} value={responsable} onChange={(e) => setResponsable(e.target.value)} onBlur={() => saveIfChanged('responsable', responsable)} aria-label="Responsable" />
      <button
        onClick={() => remove.mutate(tarea.id)}
        disabled={remove.isPending}
        aria-label="Eliminar tarea"
        className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--danger)] justify-self-center"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function NuevaTareaRow({ plantillaId, orden }: { plantillaId: string; orden: number }) {
  const create = useCreatePlantillaTarea();
  const [label, setLabel] = useState('');
  const [fase, setFase] = useState('');
  const [responsable, setResponsable] = useState('');

  const onAdd = async () => {
    if (!label.trim() || !fase.trim() || !responsable.trim()) return;
    await create.mutateAsync({ plantillaId, label: label.trim(), fase: fase.trim(), responsable: responsable.trim(), orden });
    setLabel('');
    setFase('');
    setResponsable('');
  };

  return (
    <div className="grid grid-cols-[1fr_140px_120px_32px] gap-2 items-center py-1 mt-1 border-t border-[var(--line-subtle)] pt-2">
      <Input placeholder="Nueva tarea…" value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input placeholder="Fase" value={fase} onChange={(e) => setFase(e.target.value)} />
      <Input placeholder="Responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
      <button
        onClick={onAdd}
        disabled={create.isPending}
        aria-label="Añadir tarea"
        className="h-8 px-2 rounded-md text-[16px] leading-none text-[var(--accent-ink)] hover:bg-[var(--bg-hover)] justify-self-center"
      >
        +
      </button>
    </div>
  );
}

function PlantillaPanel({ plantilla }: { plantilla: Plantilla }) {
  const updatePlantilla = useUpdatePlantilla();
  const duplicar = useDuplicarPlantilla();
  const [nombre, setNombre] = useState(plantilla.nombre);

  const fases = [...new Set(plantilla.tareas.map((t) => t.fase))];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <input
          className="font-serif text-[15px] font-medium bg-transparent border border-transparent hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:outline-none rounded px-2 py-1 -mx-2 flex-1"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => nombre.trim() && nombre !== plantilla.nombre && updatePlantilla.mutate({ id: plantilla.id, nombre: nombre.trim() })}
          aria-label="Nombre de la plantilla"
        />
        <Badge variant={plantilla.activa ? 'success' : 'neutral'} dot>
          {plantilla.activa ? 'Activa' : 'Archivada'}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] text-[var(--ink-tertiary)]">
          {plantilla.tareas.length} tareas · {fases.length} fases · usada en {plantilla._count?.procesos ?? 0} procesos
        </span>
        <span className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => updatePlantilla.mutate({ id: plantilla.id, activa: !plantilla.activa })}
          disabled={updatePlantilla.isPending}
        >
          {plantilla.activa ? 'Archivar' : 'Activar'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => duplicar.mutate(plantilla.id)} disabled={duplicar.isPending}>
          Duplicar
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_140px_120px_32px] gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] font-medium">Tarea</span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] font-medium">Fase</span>
        <span className="text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] font-medium">Responsable</span>
        <span />
      </div>
      {plantilla.tareas.map((t) => (
        <TareaRow key={t.id} tarea={t} />
      ))}
      <NuevaTareaRow plantillaId={plantilla.id} orden={plantilla.tareas.length} />
    </div>
  );
}

export function PlantillaEditorModal({ tipo, onClose }: { tipo: TipoProceso; onClose: () => void }) {
  const { data: plantillas, isLoading } = usePlantillas(tipo);
  const createPlantilla = useCreatePlantilla();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = plantillas?.find((p) => p.id === selectedId) ?? plantillas?.[0];

  const onCreate = async () => {
    if (!newName.trim()) return;
    const p = await createPlantilla.mutateAsync({ nombre: newName.trim(), tipo });
    setSelectedId(p.id);
    setCreating(false);
    setNewName('');
  };

  return (
    <Modal
      title={`Plantillas de ${tipo === 'ONBOARDING' ? 'onboarding' : 'offboarding'}`}
      subtitle="Fases, tareas y responsables. Iniciar un proceso copia la plantilla activa en ese momento."
      onClose={onClose}
      wide
    >
      {isLoading && <p className="text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>}

      {plantillas && (
        <div className="grid grid-cols-[200px_1fr] gap-5">
          <div className="flex flex-col gap-1">
            {plantillas.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`text-left px-3 py-2 rounded-md text-[13px] transition-colors ${
                  (selected?.id ?? plantillas[0]?.id) === p.id
                    ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)] font-medium'
                    : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {p.nombre}
                {!p.activa && <span className="text-[var(--ink-tertiary)]"> · archivada</span>}
              </button>
            ))}
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="text-left px-3 py-2 rounded-md text-[12px] font-medium text-[var(--accent-ink)] hover:bg-[var(--bg-hover)]"
              >
                + Nueva plantilla
              </button>
            ) : (
              <div className="px-1 py-2 flex flex-col gap-2">
                <Input autoFocus placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={onCreate} disabled={createPlantilla.isPending}>
                    Crear
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>{selected ? <PlantillaPanel key={selected.id} plantilla={selected} /> : <p className="text-[13px] text-[var(--ink-tertiary)]">No hay plantillas todavía.</p>}</div>
        </div>
      )}
    </Modal>
  );
}
