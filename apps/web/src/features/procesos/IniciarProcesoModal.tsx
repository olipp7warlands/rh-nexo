import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useEmployees } from '../employees/useEmployees';
import { useCreateProceso, usePlantillas, type TipoProceso } from './useProcesos';

const schema = z.object({
  employeeId: z.string().min(1, 'Obligatorio'),
  buddyId: z.string().optional(),
  plantillaId: z.string().optional(),
  fechaInicio: z.string().min(1, 'Obligatorio'),
  fechaObjetivo: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function IniciarProcesoModal({ tipo, onClose }: { tipo: TipoProceso; onClose: () => void }) {
  const { data: employees } = useEmployees({});
  const { data: plantillas } = usePlantillas(tipo);
  const create = useCreateProceso();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { employeeId: '', buddyId: '', plantillaId: '', fechaInicio: todayISO(), fechaObjetivo: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await create.mutateAsync({
        employeeId: data.employeeId,
        tipo,
        buddyId: data.buddyId || undefined,
        plantillaId: data.plantillaId || undefined,
        fechaInicio: data.fechaInicio,
        fechaObjetivo: data.fechaObjetivo || undefined,
      });
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  const titulo = tipo === 'ONBOARDING' ? 'Iniciar onboarding' : 'Iniciar offboarding';

  return (
    <Modal
      title={titulo}
      subtitle="Se copian las tareas de la plantilla activa; editarla después no afecta a este proceso."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Iniciar proceso'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Persona <span className="text-[var(--danger)]">*</span>
          </label>
          <select className={selectClass} {...register('employeeId')}>
            <option value="">Selecciona una persona…</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
          {errors.employeeId && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.employeeId.message}</p>}
        </div>

        {tipo === 'ONBOARDING' && (
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Buddy</label>
            <select className={selectClass} {...register('buddyId')}>
              <option value="">Sin buddy asignado</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Plantilla</label>
          <select className={selectClass} {...register('plantillaId')}>
            <option value="">Plantilla activa por defecto</option>
            {plantillas?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {!p.activa && '(archivada)'}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
              Fecha de inicio <span className="text-[var(--danger)]">*</span>
            </label>
            <Input type="date" {...register('fechaInicio')} />
            {errors.fechaInicio && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.fechaInicio.message}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Fecha objetivo</label>
            <Input type="date" {...register('fechaObjetivo')} />
          </div>
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
