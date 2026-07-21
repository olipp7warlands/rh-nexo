import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useEmployees, type Employee } from '../employees/useEmployees';
import {
  useCategorias,
  useCreateAnotacion,
  useCreateCategoria,
  useUpdateAnotacion,
  type Anotacion,
} from './useAnotaciones';

const schema = z.object({
  empleadoId: z.string().min(1, 'Obligatorio'),
  categoriaId: z.string().optional(),
  texto: z.string().min(1, 'Obligatorio'),
  fecha: z.string().min(1, 'Obligatorio'),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AnotacionModal({
  mode,
  anotacion,
  presetEmpleado,
  onClose,
}: {
  mode: 'create' | 'edit';
  anotacion?: Anotacion;
  presetEmpleado?: Employee;
  onClose: () => void;
}) {
  const { data: employees } = useEmployees({});
  const { data: categorias } = useCategorias();
  const create = useCreateAnotacion();
  const update = useUpdateAnotacion(anotacion?.id ?? '');
  const createCategoria = useCreateCategoria();
  const mutation = mode === 'create' ? create : update;

  const [serverError, setServerError] = useState<string | null>(null);
  const [creatingCategoria, setCreatingCategoria] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#4D6B80');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: anotacion
      ? {
          empleadoId: anotacion.empleadoId,
          categoriaId: anotacion.categoriaId ?? '',
          texto: anotacion.texto,
          fecha: anotacion.fecha.slice(0, 10),
        }
      : { empleadoId: presetEmpleado?.id ?? '', categoriaId: '', texto: '', fecha: todayISO() },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await mutation.mutateAsync({
        empleadoId: data.empleadoId,
        categoriaId: data.categoriaId || undefined,
        texto: data.texto,
        fecha: data.fecha,
      });
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  const onCreateCategoria = async () => {
    if (!newCatName.trim()) return;
    try {
      const cat = await createCategoria.mutateAsync({ nombre: newCatName.trim(), color: newCatColor });
      setValue('categoriaId', cat.id);
      setCreatingCategoria(false);
      setNewCatName('');
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  const empleadoId = watch('empleadoId');
  const selectedEmployee = presetEmpleado ?? employees?.find((e) => e.id === empleadoId);

  return (
    <Modal
      title={mode === 'create' ? 'Nueva anotación' : 'Editar anotación'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : mode === 'create' ? 'Crear anotación' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Persona <span className="text-[var(--danger)]">*</span>
          </label>
          {presetEmpleado || mode === 'edit' ? (
            <div className="h-9 px-3 flex items-center bg-[var(--bg-subtle)] rounded-md text-[13px]">
              {selectedEmployee?.fullName ?? '—'}
            </div>
          ) : (
            <select className={selectClass} {...register('empleadoId')}>
              <option value="">Selecciona una persona…</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          )}
          {errors.empleadoId && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.empleadoId.message}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Categoría</label>
          {!creatingCategoria ? (
            <div className="flex items-center gap-2">
              <select className={selectClass} {...register('categoriaId')}>
                <option value="">Sin categoría</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <Button variant="secondary" type="button" size="sm" onClick={() => setCreatingCategoria(true)}>
                + Nueva
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                placeholder="Nombre de la categoría"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="w-9 h-9 rounded-md border border-[var(--line-strong)] cursor-pointer shrink-0"
                aria-label="Color de la categoría"
              />
              <Button variant="secondary" type="button" size="sm" onClick={onCreateCategoria} disabled={createCategoria.isPending}>
                Crear
              </Button>
              <Button variant="ghost" type="button" size="sm" onClick={() => setCreatingCategoria(false)}>
                ✕
              </Button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Fecha <span className="text-[var(--danger)]">*</span>
          </label>
          <Input type="date" {...register('fecha')} />
          {errors.fecha && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.fecha.message}</p>}
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Texto <span className="text-[var(--danger)]">*</span>
          </label>
          <textarea
            rows={4}
            className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all resize-y"
            {...register('texto')}
          />
          {errors.texto && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.texto.message}</p>}
        </div>

        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
