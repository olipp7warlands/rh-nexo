import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useCreateSociedad, useUpdateSociedad, type Sociedad } from './useEstructura';
import { PaisSelectField } from './PaisSelectField';

const schema = z.object({
  nombre: z.string().min(1, 'Obligatorio'),
  paisId: z.string().min(1, 'Obligatorio'),
});
type FormData = z.infer<typeof schema>;

export function SociedadModal({ mode, sociedad, onClose }: { mode: 'create' | 'edit'; sociedad?: Sociedad; onClose: () => void }) {
  const create = useCreateSociedad();
  const update = useUpdateSociedad(sociedad?.id ?? '');
  const mutation = mode === 'create' ? create : update;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: sociedad ? { nombre: sociedad.nombre, paisId: sociedad.paisId } : undefined,
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
      title={mode === 'create' ? 'Añadir sociedad' : `Editar · ${sociedad?.nombre}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : mode === 'create' ? 'Crear sociedad' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Nombre <span className="text-[var(--danger)]">*</span>
          </label>
          <Input autoFocus {...register('nombre')} />
          {errors.nombre && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.nombre.message}</p>}
        </div>
        <PaisSelectField
          label="País"
          required
          error={errors.paisId?.message}
          registerReturn={register('paisId')}
          onCreated={(id) => setValue('paisId', id, { shouldValidate: true })}
        />
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
