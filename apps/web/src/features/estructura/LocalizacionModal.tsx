import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useCreateLocalizacion, useUpdateLocalizacion, type Localizacion } from './useEstructura';
import { PaisSelectField } from './PaisSelectField';

// El país es obligatorio al crear. Al editar queda opcional solo si la localización aún no lo tiene
// (creadas antes de existir el campo): se puede renombrar sin forzar, pero el aviso invita a asignarlo.
const schema = (mode: 'create' | 'edit') =>
  z.object({
    nombre: z.string().min(1, 'Obligatorio'),
    paisId: mode === 'create' ? z.string().min(1, 'Obligatorio') : z.string(),
  });
type FormData = { nombre: string; paisId: string };

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
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema(mode)),
    defaultValues: { nombre: localizacion?.nombre ?? '', paisId: localizacion?.paisId ?? '' },
  });
  const pending = create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      if (mode === 'create') await create.mutateAsync({ nombre: data.nombre, paisId: data.paisId });
      else await update.mutateAsync({ nombre: data.nombre, ...(data.paisId ? { paisId: data.paisId } : {}) });
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
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending ? 'Guardando…' : mode === 'create' ? 'Crear localización' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor="loc-nombre" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Nombre <span className="text-[var(--danger)]">*</span>
          </label>
          <Input id="loc-nombre" autoFocus {...register('nombre')} />
          {errors.nombre && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.nombre.message}</p>}
        </div>
        <PaisSelectField
          label="País"
          required={mode === 'create' || !!localizacion?.paisId}
          error={errors.paisId?.message}
          registerReturn={register('paisId')}
          onCreated={(id) => setValue('paisId', id, { shouldValidate: true })}
        />
        {mode === 'edit' && !localizacion?.paisId && (
          <p className="text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2">
            Esta localización se creó sin país. Asígnaselo para que los festivos y filtros por país la reconozcan.
          </p>
        )}
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
