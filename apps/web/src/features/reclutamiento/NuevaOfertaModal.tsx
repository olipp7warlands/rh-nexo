import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useDepartments } from '../employees/useDepartments';
import { useEmployees } from '../employees/useEmployees';
import { useProyectos, useSociedades } from '../estructura/useEstructura';
import { useCreateJob } from './useRecruitment';

const schema = z.object({
  title: z.string().min(1, 'Obligatorio'),
  departmentId: z.string().optional(),
  location: z.string().min(1, 'Obligatorio'),
  remote: z.boolean().optional(),
  level: z.string().min(1, 'Obligatorio'),
  openings: z.coerce.number().int().min(1).optional(),
  hiringManagerId: z.string().optional(),
  sociedadId: z.string().optional(),
  proyectoId: z.string().optional(),
  description: z.string().optional(),
  status: z.enum(['ABIERTA', 'PAUSADA', 'CERRADA']),
  openedAt: z.string().min(1, 'Obligatoria'),
  closedAt: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.status === 'CERRADA') {
    if (!d.closedAt) ctx.addIssue({ code: 'custom', path: ['closedAt'], message: 'Obligatoria en una oferta cerrada' });
    else if (d.openedAt && d.closedAt < d.openedAt) {
      ctx.addIssue({ code: 'custom', path: ['closedAt'], message: 'No puede ser anterior a la apertura' });
    }
  }
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function NuevaOfertaModal({ onClose }: { onClose: () => void }) {
  const { data: departments } = useDepartments();
  const { data: employees } = useEmployees();
  const { data: sociedades } = useSociedades();
  const { data: proyectos } = useProyectos();
  const create = useCreateJob();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { openings: 1, status: 'ABIERTA', openedAt: new Date().toISOString().slice(0, 10) },
  });
  const status = watch('status');

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
        sociedadId: data.sociedadId || undefined,
        proyectoId: data.proyectoId || undefined,
        description: data.description || undefined,
        status: data.status,
        openedAt: data.openedAt,
        closedAt: data.status === 'CERRADA' ? data.closedAt : undefined,
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
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="oferta-estado" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
              Estado
            </label>
            <select id="oferta-estado" className={selectClass} {...register('status')}>
              <option value="ABIERTA">Abierta</option>
              <option value="PAUSADA">Pausada</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </div>
          <div>
            <label htmlFor="oferta-apertura" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
              Fecha de apertura
            </label>
            <Input id="oferta-apertura" type="date" {...register('openedAt')} />
            {errors.openedAt && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.openedAt.message}</p>}
          </div>
          {status === 'CERRADA' && (
            <div>
              <label htmlFor="oferta-cierre" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
                Fecha de cierre
              </label>
              <Input id="oferta-cierre" type="date" {...register('closedAt')} />
              {errors.closedAt && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.closedAt.message}</p>}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="oferta-proyecto" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Proyecto (opcional)
          </label>
          <select id="oferta-proyecto" className={selectClass} {...register('proyectoId')}>
            <option value="">Sin proyecto</option>
            {proyectos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="oferta-sociedad" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Sociedad
          </label>
          <select id="oferta-sociedad" className={selectClass} {...register('sociedadId')}>
            <option value="">Sin asignar</option>
            {sociedades?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
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
