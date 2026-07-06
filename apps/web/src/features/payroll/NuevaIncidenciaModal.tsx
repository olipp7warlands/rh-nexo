import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useEmployees } from '../employees/useEmployees';
import { useAddPayrollItem, PAYROLL_ITEM_TYPE_LABEL, type PayrollItemType } from './usePayroll';

const schema = z.object({
  employeeId: z.string().min(1, 'Obligatorio'),
  type: z.enum(['BONUS', 'HORAS_EXTRA', 'DEDUCCION']),
  concept: z.string().min(1, 'Obligatorio'),
  amount: z.coerce.number().positive('Debe ser mayor que 0'),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function NuevaIncidenciaModal({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { data: employees } = useEmployees();
  const addItem = useAddPayrollItem(runId);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { type: 'BONUS' } });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      // El usuario siempre teclea una magnitud positiva; el signo lo decide el tipo.
      const amount = data.type === 'DEDUCCION' ? -Math.abs(data.amount) : Math.abs(data.amount);
      await addItem.mutateAsync({ employeeId: data.employeeId, type: data.type as PayrollItemType, concept: data.concept, amount });
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Añadir incidencia"
      subtitle="Bonus, horas extra o deducción. Recalcula el recibo del empleado al instante."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={addItem.isPending}>
            {addItem.isPending ? 'Guardando…' : 'Añadir'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Empleado</label>
          <select className={selectClass} {...register('employeeId')}>
            <option value="">Selecciona…</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
          {errors.employeeId && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.employeeId.message}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Tipo</label>
          <select className={selectClass} {...register('type')}>
            {(Object.keys(PAYROLL_ITEM_TYPE_LABEL) as PayrollItemType[]).map((t) => (
              <option key={t} value={t}>
                {PAYROLL_ITEM_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Concepto</label>
          <Input placeholder="p. ej. Bonus por objetivos Q2" {...register('concept')} />
          {errors.concept && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.concept.message}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Importe (€)</label>
          <Input type="number" min="0" step="1" {...register('amount')} />
          {errors.amount && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.amount.message}</p>}
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
