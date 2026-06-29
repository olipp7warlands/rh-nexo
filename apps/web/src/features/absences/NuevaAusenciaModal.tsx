import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useCreateAbsence } from './useAbsences';
import { businessDays } from '../../lib/format';

const schema = z
  .object({
    type: z.enum(['VACACIONES', 'ENFERMEDAD', 'PERSONAL', 'MATERNIDAD']),
    startDate: z.string().min(1, 'Obligatorio'),
    endDate: z.string().min(1, 'Obligatorio'),
    reason: z.string().optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: 'La fecha de fin no puede ser anterior al inicio',
    path: ['endDate'],
  });
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function NuevaAusenciaModal({ onClose }: { onClose: () => void }) {
  const create = useCreateAbsence();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { type: 'VACACIONES' } });

  const [start, end] = [watch('startDate'), watch('endDate')];
  const preview = start && end ? businessDays(start, end) : 0;

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await create.mutateAsync(data);
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Nueva solicitud de ausencia"
      subtitle="Los días se calculan sobre laborables, descontando festivos."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={create.isPending}>
            {create.isPending ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Tipo</label>
          <select className={selectClass} {...register('type')}>
            <option value="VACACIONES">Vacaciones</option>
            <option value="ENFERMEDAD">Enfermedad</option>
            <option value="PERSONAL">Personal</option>
            <option value="MATERNIDAD">Maternidad</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Desde</label>
            <Input type="date" {...register('startDate')} />
            {errors.startDate && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.startDate.message}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Hasta</label>
            <Input type="date" {...register('endDate')} />
            {errors.endDate && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.endDate.message}</p>}
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Motivo (opcional)</label>
          <Input placeholder="p. ej. Vacaciones de verano" {...register('reason')} />
        </div>

        {preview > 0 && (
          <p className="text-[12px] text-[var(--ink-secondary)]">
            Aprox. <span className="font-semibold text-[var(--ink-primary)]">{preview} días laborables</span> (el
            servidor descuenta festivos al confirmar).
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
