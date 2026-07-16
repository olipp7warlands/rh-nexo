import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useCreateLocalizacion, useUpdateLocalizacion, type Localizacion } from './useEstructura';

const schema = z.object({ nombre: z.string().min(1, 'Obligatorio') });
type FormData = z.infer<typeof schema>;

export function LocalizacionModal({
  mode,
  localizacion,
  onClose,
}: {
  mode: 'create' | 'edit';
  localizacion?: Localizacion;
  onClose: () => void;
}) {
  const create = useCreateLocalizacion();
  const update = useUpdateLocalizacion(localizacion?.id ?? '');
  const mutation = mode === 'create' ? create : update;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: localizacion ? { nombre: localizacion.nombre } : undefined,
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
      title={mode === 'create' ? 'Añadir localización' : `Editar · ${localizacion?.nombre}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : mode === 'create' ? 'Crear localización' : 'Guardar cambios'}
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
