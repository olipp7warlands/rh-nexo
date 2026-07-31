import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import type { Catalogo } from './useEstructura';

const schema = z.object({ nombre: z.string().min(1, 'Obligatorio') });
type FormData = z.infer<typeof schema>;

// humanX Tanda 2: modal genérico de crear/editar para los catálogos "id + nombre" (TipoContrato,
// Jornada, RelacionEmergencia, Proyecto, Idioma) — mismo esqueleto que LocalizacionModal, con los
// hooks de mutación inyectados para no repetir 5 versiones casi idénticas del mismo componente.
export function CatalogoModal({
  singular,
  item,
  useCreate,
  useUpdate,
  onClose,
}: {
  singular: string;
  item?: Catalogo;
  useCreate: () => { mutateAsync: (data: { nombre: string }) => Promise<Catalogo>; isPending: boolean };
  useUpdate: (id: string) => { mutateAsync: (data: { nombre: string }) => Promise<Catalogo>; isPending: boolean };
  onClose: () => void;
}) {
  const create = useCreate();
  const update = useUpdate(item?.id ?? '');
  const mutation = item ? update : create;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: item ? { nombre: item.nombre } : undefined,
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await mutation.mutateAsync(data);
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title={item ? `Editar · ${item.nombre}` : `Añadir ${singular}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : item ? 'Guardar cambios' : `Crear ${singular}`}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
          Nombre <span className="text-[var(--danger)]">*</span>
        </label>
        <Input autoFocus {...register('nombre')} />
        {errors.nombre && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.nombre.message}</p>}
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2 mt-4">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
