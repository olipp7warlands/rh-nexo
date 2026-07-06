import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useGenerateRun } from './usePayroll';

const schema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'El periodo debe tener formato AAAA-MM'),
});
type FormData = z.infer<typeof schema>;

export function NuevaNominaModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const generate = useGenerateRun();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      const run = await generate.mutateAsync(data.period);
      onCreated(run.id);
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Generar nómina"
      subtitle="Crea un periodo nuevo y calcula el recibo de cada empleado con salario."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={generate.isPending}>
            {generate.isPending ? 'Generando…' : 'Generar'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Periodo</label>
          <Input placeholder="2026-07" {...register('period')} />
          {errors.period && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.period.message}</p>}
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
