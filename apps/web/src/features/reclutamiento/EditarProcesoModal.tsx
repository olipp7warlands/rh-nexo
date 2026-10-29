import { useState } from 'react';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useProyectos } from '../estructura/useEstructura';
import { useRemoveJobPdf, useUpdateJob, useUploadJobPdf, type JobDetail, type JobStatus } from './useRecruitment';
import { DescripcionFields, PdfField, emptyDescripcion, pdfError, CAMPOS_DESCRIPCION } from './DescripcionOferta';

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';
const labelClass = 'block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5';
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '');

/**
 * Edita el ciclo de vida de una oferta: estado, apertura, cierre (solo si está cerrada) y proyecto,
 * además de la descripción estructurada y el PDF adjunto.
 * Al volver a abrir una oferta cerrada, el servidor pone el cierre a NULL.
 */
export function EditarProcesoModal({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const { data: proyectos } = useProyectos();
  const update = useUpdateJob();
  const uploadPdf = useUploadJobPdf();
  const removePdf = useRemoveJobPdf();
  const [descripcion, setDescripcion] = useState(() => emptyDescripcion(job));
  const [pdf, setPdf] = useState<File | null>(null);
  const [quitarPdf, setQuitarPdf] = useState(false);
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [openedAt, setOpenedAt] = useState(day(job.openedAt));
  const [closedAt, setClosedAt] = useState(day(job.closedAt));
  const [proyectoId, setProyectoId] = useState(job.proyectoId ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!openedAt) return setError('La fecha de apertura es obligatoria.');
    if (status === 'CERRADA') {
      if (!closedAt) return setError('Indica la fecha de cierre.');
      if (closedAt < openedAt) return setError('La fecha de cierre no puede ser anterior a la de apertura.');
    }
    if (pdf) {
      const msg = pdfError(pdf);
      if (msg) return setError(msg);
    }
    try {
      await update.mutateAsync({
        id: job.id,
        status,
        openedAt,
        closedAt: status === 'CERRADA' ? closedAt : undefined,
        proyectoId: proyectoId || undefined,
        // En edición se envía el texto tal cual (vacío incluido) para poder borrar un campo.
        ...Object.fromEntries(CAMPOS_DESCRIPCION.map(({ key }) => [key, descripcion[key].trim()])),
      });
    } catch (e) {
      return setError((e as Error).message);
    }
    try {
      if (pdf) await uploadPdf.mutateAsync({ id: job.id, file: pdf });
      else if (quitarPdf && job.tienePdf) await removePdf.mutateAsync(job.id);
      onClose();
    } catch (e) {
      setError(`Los cambios se guardaron, pero el PDF falló: ${(e as Error).message}`);
    }
  };

  return (
    <Modal
      title="Editar proceso"
      subtitle={job.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} disabled={update.isPending || uploadPdf.isPending || removePdf.isPending}>
            {update.isPending || uploadPdf.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="edit-estado" className={labelClass}>
              Estado
            </label>
            <select id="edit-estado" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
              <option value="BORRADOR">Borrador</option>
              <option value="ABIERTA">Abierta</option>
              <option value="PAUSADA">Pausada</option>
              <option value="CERRADA">Cerrada</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-apertura" className={labelClass}>
              Fecha de apertura
            </label>
            <Input id="edit-apertura" type="date" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
          </div>
          {status === 'CERRADA' && (
            <div>
              <label htmlFor="edit-cierre" className={labelClass}>
                Fecha de cierre
              </label>
              <Input id="edit-cierre" type="date" value={closedAt} min={openedAt || undefined} onChange={(e) => setClosedAt(e.target.value)} />
            </div>
          )}
        </div>
        {job.status === 'CERRADA' && status !== 'CERRADA' && (
          <p className="text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2">
            Al reabrir la oferta se elimina su fecha de cierre.
          </p>
        )}
        <div>
          <label htmlFor="edit-proyecto" className={labelClass}>
            Proyecto
          </label>
          <select id="edit-proyecto" className={selectClass} value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
            <option value="">Sin proyecto</option>
            {proyectos?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <DescripcionFields values={descripcion} onChange={setDescripcion} />
        {job.description && !CAMPOS_DESCRIPCION.some(({ key }) => job[key]) && (
          <p className="text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2 whitespace-pre-line">
            <strong className="font-medium">Descripción anterior (se mostrará hasta que rellenes los campos de arriba):</strong>
            {'\n'}
            {job.description}
          </p>
        )}
        <PdfField
          file={pdf}
          onFile={setPdf}
          current={job.tienePdf && !quitarPdf ? (job.descripcionPdfNombre ?? 'PDF adjunto') : null}
          onRemoveCurrent={() => setQuitarPdf(true)}
        />
        {error && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
