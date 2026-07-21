import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useEmployees } from '../employees/useEmployees';
import { useCreateDocument, useCreateDocumentWithFile, DOCUMENT_CATEGORY_LABEL, type DocumentCategory } from './useDocuments';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, en línea con el backend
const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.png,.jpg,.jpeg';

const schema = z.object({
  name: z.string().min(1, 'Obligatorio'),
  category: z.enum(['CONTRATOS', 'NOMINAS', 'POLITICAS', 'CERTIFICADOS', 'FORMACION']),
  ownerId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

export function NuevoDocumentoModal({
  onClose,
  presetOwner,
}: {
  onClose: () => void;
  /** Preselecciona y bloquea el responsable (p. ej. al subir desde la ficha de una persona). */
  presetOwner?: { id: string; fullName: string };
}) {
  const { data: employees } = useEmployees();
  const create = useCreateDocument();
  const createWithFile = useCreateDocumentWithFile();
  const [signerIds, setSignerIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'CONTRATOS', ownerId: presetOwner?.id ?? '' },
  });

  const pending = create.isPending || createWithFile.isPending;

  const toggleSigner = (id: string) =>
    setSignerIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    if (picked && picked.size > MAX_FILE_SIZE_BYTES) {
      setServerError('El fichero supera el tamaño máximo (10 MB).');
      e.target.value = '';
      setFile(null);
      return;
    }
    setServerError(null);
    setFile(picked);
  };

  const onSubmit = handleSubmit(async (data) => {
    setServerError(null);
    try {
      if (file) {
        await createWithFile.mutateAsync({
          name: data.name,
          category: data.category as DocumentCategory,
          ownerId: data.ownerId || undefined,
          signerIds: signerIds.length ? signerIds : undefined,
          file,
        });
      } else {
        await create.mutateAsync({
          name: data.name,
          category: data.category as DocumentCategory,
          ownerId: data.ownerId || undefined,
          signerIds: signerIds.length ? signerIds : undefined,
        });
      }
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <Modal
      title="Subir documento"
      subtitle="Alta de metadatos del documento; opcionalmente pide firma a uno o varios empleados."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={pending}>
            {pending ? 'Guardando…' : 'Subir'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Nombre</label>
          <Input placeholder="p. ej. Acuerdo de confidencialidad" {...register('name')} />
          {errors.name && <p className="text-[12px] text-[var(--danger)] mt-1.5">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Categoría</label>
          <select className={selectClass} {...register('category')}>
            {(Object.keys(DOCUMENT_CATEGORY_LABEL) as (keyof typeof DOCUMENT_CATEGORY_LABEL)[]).map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="doc-file" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Fichero (opcional)
          </label>
          <input
            id="doc-file"
            type="file"
            accept={ALLOWED_EXTENSIONS}
            onChange={onFileChange}
            className="w-full text-[13px] text-[var(--ink-secondary)] file:mr-3 file:h-9 file:px-3 file:rounded-md file:border-0 file:bg-[var(--bg-hover)] file:text-[13px] file:font-medium file:text-[var(--ink-primary)] file:cursor-pointer"
          />
          <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">
            PDF, Word, PNG o JPG, máx. 10 MB. Sin fichero, el documento queda solo con metadatos.
          </p>
        </div>
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Responsable {!presetOwner && '(opcional)'}</label>
          {presetOwner ? (
            <div className="h-9 px-3 flex items-center bg-[var(--bg-subtle)] rounded-md text-[13px]">{presetOwner.fullName}</div>
          ) : (
            <select className={selectClass} {...register('ownerId')}>
              <option value="">Yo mismo</option>
              {employees?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          )}
        </div>
        <fieldset>
          <legend className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Firmantes (opcional)</legend>
          <div className="max-h-40 overflow-y-auto border border-[var(--line)] rounded-md divide-y divide-[var(--line-subtle)]">
            {employees?.map((e) => (
              <label key={e.id} className="flex items-center gap-2 px-3 py-2 text-[13px] hover:bg-[var(--bg-subtle)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={signerIds.includes(e.id)}
                  onChange={() => toggleSigner(e.id)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                {e.fullName}
              </label>
            ))}
          </div>
        </fieldset>
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
