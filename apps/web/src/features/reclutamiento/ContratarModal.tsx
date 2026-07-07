import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useDepartments } from '../employees/useDepartments';
import { useEmployees } from '../employees/useEmployees';
import { useHireApplication, type JobDetail } from './useRecruitment';

const schema = z.object({
  startDate: z.string().min(1, 'Obligatorio'),
  jobTitle: z.string().optional(),
  level: z.string().optional(),
  location: z.string().optional(),
  departmentId: z.string().optional(),
  managerId: z.string().optional(),
  salary: z.coerce.number().int().min(0).optional(),
  buddyId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function ContratarModal({
  applicationId,
  job,
  candidateFullName,
  onClose,
  onHired,
}: {
  applicationId: string;
  job: JobDetail;
  candidateFullName: string;
  onClose: () => void;
  onHired: () => void;
}) {
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees();
  const hire = useHireApplication();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      jobTitle: job.title,
      level: job.level,
      location: job.location,
      departmentId: job.departmentId ?? '',
      managerId: job.hiringManagerId ?? '',
    },
  });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await hire.mutateAsync({
        applicationId,
        startDate: data.startDate,
        jobTitle: data.jobTitle || undefined,
        level: data.level || undefined,
        location: data.location || undefined,
        departmentId: data.departmentId || undefined,
        managerId: data.managerId || undefined,
        salary: data.salary,
        buddyId: data.buddyId || undefined,
      });
      onHired();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Contratar candidato"
      subtitle={`${candidateFullName} pasará a ser empleado y arrancará su onboarding con la plantilla estándar.`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={hire.isPending}>
            {hire.isPending ? 'Contratando…' : 'Confirmar contratación'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Fecha de incorporación</label>
          <Input type="date" {...register('startDate')} />
          {errors.startDate && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.startDate.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Puesto</label>
            <Input {...register('jobTitle')} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Nivel</label>
            <Input {...register('level')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Ubicación</label>
            <Input {...register('location')} />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Salario bruto anual (opcional)</label>
            <Input type="number" min="0" {...register('salary')} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Departamento</label>
            <select className={selectClass} {...register('departmentId')}>
              <option value="">Sin asignar</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Manager</label>
            <select className={selectClass} {...register('managerId')}>
              <option value="">Sin asignar</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Buddy de onboarding (opcional)</label>
          <select className={selectClass} {...register('buddyId')}>
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
