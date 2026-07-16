import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useEmployees } from '../employees/useEmployees';
import { useCreateDepartment, useUpdateDepartment, type DepartmentWithMeta } from '../employees/useDepartments';

const schema = z.object({
  name: z.string().min(1, 'Obligatorio'),
  color: z
    .string()
    .min(1, 'Obligatorio')
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Formato hex, p. ej. #6366F1'),
  leadId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all';

function clean(data: FormData) {
  return { name: data.name, color: data.color, leadId: data.leadId || undefined };
}

export function DepartmentModal({
  mode,
  department,
  onClose,
}: {
  mode: 'create' | 'edit';
  department?: DepartmentWithMeta;
  onClose: () => void;
}) {
  const { data: employees } = useEmployees({});
  const create = useCreateDepartment();
  const update = useUpdateDepartment(department?.id ?? '');
  const mutation = mode === 'create' ? create : update;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: department
      ? { name: department.name, color: department.color, leadId: department.leadId ?? '' }
      : { color: '#0F1419' },
  });
  const color = watch('color');

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await mutation.mutateAsync(clean(data));
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title={mode === 'create' ? 'Añadir departamento' : `Editar · ${department?.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando…' : mode === 'create' ? 'Crear departamento' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Nombre <span className="text-[var(--danger)]">*</span>
          </label>
          <Input autoFocus {...register('name')} />
          {errors.name && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Color <span className="text-[var(--danger)]">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input type="color" {...register('color')} className="w-9 h-9 rounded-md border border-[var(--line-strong)] cursor-pointer" />
            <Input {...register('color')} className="mono" placeholder="#0F1419" />
            <span className="w-4 h-4 rounded-full shrink-0" style={{ background: color }} />
          </div>
          {errors.color && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.color.message}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Responsable</label>
          <select className={selectClass} {...register('leadId')}>
            <option value="">Sin asignar</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
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
