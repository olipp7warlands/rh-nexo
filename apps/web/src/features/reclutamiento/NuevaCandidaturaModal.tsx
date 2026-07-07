import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useCandidates, useCreateApplication, useCreateCandidate, type CandidateSource } from './useRecruitment';

const schema = z.object({
  mode: z.enum(['existente', 'nuevo']),
  candidateId: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  linkedinUrl: z.string().optional(),
  resumeUrl: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function NuevaCandidaturaModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const { data: candidates } = useCandidates();
  const createCandidate = useCreateCandidate();
  const createApplication = useCreateApplication();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { mode: 'nuevo', source: 'PORTAL' } });

  const mode = watch('mode');
  const pending = createCandidate.isPending || createApplication.isPending;

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      let candidateId = data.candidateId;
      if (data.mode === 'nuevo') {
        if (!data.fullName || !data.email) {
          setServerError('Nombre y email son obligatorios.');
          return;
        }
        const candidate = await createCandidate.mutateAsync({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone || undefined,
          source: (data.source || 'PORTAL') as CandidateSource,
          linkedinUrl: data.linkedinUrl || undefined,
          resumeUrl: data.resumeUrl || undefined,
        });
        candidateId = candidate.id;
      }
      if (!candidateId) {
        setServerError('Selecciona un candidato.');
        return;
      }
      await createApplication.mutateAsync({ candidateId, jobId });
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Añadir candidatura"
      subtitle="Vincula un candidato existente a esta oferta, o da de alta uno nuevo."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending ? 'Guardando…' : 'Añadir'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex gap-1 p-1 bg-[var(--bg-hover)] rounded-lg w-fit">
          <label className={`px-3 h-8 flex items-center text-[12px] font-medium rounded-md cursor-pointer ${mode === 'nuevo' ? 'bg-[var(--bg-surface)] shadow-sm' : 'text-[var(--ink-secondary)]'}`}>
            <input type="radio" value="nuevo" className="sr-only" {...register('mode')} /> Nuevo candidato
          </label>
          <label className={`px-3 h-8 flex items-center text-[12px] font-medium rounded-md cursor-pointer ${mode === 'existente' ? 'bg-[var(--bg-surface)] shadow-sm' : 'text-[var(--ink-secondary)]'}`}>
            <input type="radio" value="existente" className="sr-only" {...register('mode')} /> Candidato existente
          </label>
        </div>

        {mode === 'existente' ? (
          <div>
            <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Candidato</label>
            <select className={selectClass} {...register('candidateId')}>
              <option value="">Selecciona…</option>
              {candidates?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} · {c.email}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Nombre completo</label>
                <Input placeholder="Nombre y apellidos" {...register('fullName')} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Email</label>
                <Input type="email" placeholder="correo@ejemplo.com" {...register('email')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Teléfono (opcional)</label>
                <Input placeholder="+34 6·· ··· ···" {...register('phone')} />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Fuente</label>
                <select className={selectClass} {...register('source')}>
                  <option value="PORTAL">Portal</option>
                  <option value="REFERIDO">Referido</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="AGENCIA">Agencia</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">CV (URL, opcional)</label>
              <Input placeholder="https://…" {...register('resumeUrl')} />
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">
                Sin CV, el cribado automático descartará esta candidatura.
              </p>
            </div>
          </>
        )}

        {errors.candidateId && <p className="text-[12px] text-[var(--danger)]">{errors.candidateId.message}</p>}
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
