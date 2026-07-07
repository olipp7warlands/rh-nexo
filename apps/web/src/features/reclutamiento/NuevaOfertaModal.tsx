import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useDepartments } from '../employees/useDepartments';
import { useEmployees } from '../employees/useEmployees';
import { useCreateJob } from './useRecruitment';

const schema = z.object({
  title: z.string().min(1, 'Obligatorio'),
  departmentId: z.string().optional(),
  location: z.string().min(1, 'Obligatorio'),
  remote: z.boolean().optional(),
  level: z.string().min(1, 'Obligatorio'),
  openings: z.coerce.number().int().min(1).optional(),
  hiringManagerId: z.string().optional(),
  description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function NuevaOfertaModal({ onClose }: { onClose: () => void }) {
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees();
  const create = useCreateJob();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { openings: 1 } });

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      await create.mutateAsync({
        title: data.title,
        departmentId: data.departmentId || undefined,
        location: data.location,
        remote: data.remote,
        level: data.level,
        openings: data.openings,
        hiringManagerId: data.hiringManagerId || undefined,
        description: data.description || undefined,
      });
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Nueva oferta"
      subtitle="Publica una nueva posición para empezar a recibir candidaturas."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={create.isPending}>
            {create.isPending ? 'Creando…' : 'Crear oferta'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Puesto</label>
          <Input placeholder="p. ej. Senior Backend Engineer" {...register('title')} />
          {errors.title && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.title.message}</p>}
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
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Nivel</label>
            <Input placeholder="senior / lead / mid…" {...register('level')} />
            {errors.level && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.level.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Ubicación</label>
            <Input placeholder="Madrid" {...register('location')} />
            {errors.location && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.location.message}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Aperturas</label>
            <Input type="number" min="1" {...register('openings')} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" className="w-4 h-4 accent-[var(--accent)]" {...register('remote')} />
          Remoto
        </label>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Hiring manager</label>
          <select className={selectClass} {...register('hiringManagerId')}>
            <option value="">Sin asignar</option>
            {employees?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Descripción (opcional)</label>
          <textarea
            className="w-full min-h-20 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
            {...register('description')}
          />
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
