import { useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@nucleo/ui';
import { downloadFile } from '../../lib/api';
import type { JobDetail } from './useRecruitment';

/** Campos de la descripción estructurada de una oferta, en el orden en que se muestran. */
export const CAMPOS_DESCRIPCION = [
  { key: 'objetivoPuesto', label: 'Objetivo del puesto' },
  { key: 'funciones', label: 'Funciones y responsabilidades' },
  { key: 'requisitosEducacion', label: 'Requisitos · Educación' },
  { key: 'requisitosExperiencia', label: 'Requisitos · Experiencia' },
  { key: 'seValorara', label: 'Se valorará' },
] as const;

export type CampoDescripcion = (typeof CAMPOS_DESCRIPCION)[number]['key'];
export type DescripcionValues = Record<CampoDescripcion, string>;

export const emptyDescripcion = (job?: Partial<Record<CampoDescripcion, string | null>>): DescripcionValues => ({
  objetivoPuesto: job?.objetivoPuesto ?? '',
  funciones: job?.funciones ?? '',
  requisitosEducacion: job?.requisitosEducacion ?? '',
  requisitosExperiencia: job?.requisitosExperiencia ?? '',
  seValorara: job?.seValorara ?? '',
});

/** Valores a enviar al API: vacío => undefined (no se toca / no se crea). */
export const descripcionPayload = (v: DescripcionValues) =>
  Object.fromEntries(CAMPOS_DESCRIPCION.map(({ key }) => [key, v[key].trim() || undefined])) as Partial<
    Record<CampoDescripcion, string>
  >;

const textareaClass =
  'w-full min-h-20 px-3 py-2 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';
const labelClass = 'block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5';

/** Los cinco textareas de la descripción estructurada (controlados). */
export function DescripcionFields({ values, onChange }: { values: DescripcionValues; onChange: (v: DescripcionValues) => void }) {
  const uid = useId();
  return (
    <>
      {CAMPOS_DESCRIPCION.map(({ key, label }) => (
        <div key={key}>
          <label htmlFor={`${uid}-${key}`} className={labelClass}>
            {label} (opcional)
          </label>
          <textarea
            id={`${uid}-${key}`}
            className={textareaClass}
            maxLength={5000}
            value={values[key]}
            onChange={(e) => onChange({ ...values, [key]: e.target.value })}
          />
        </div>
      ))}
    </>
  );
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** Valida en cliente (el servidor vuelve a validar por magic bytes). Devuelve el error o null. */
export function pdfError(file: File): string | null {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return 'El fichero debe ser un PDF.';
  if (file.size > MAX_PDF_BYTES) return 'El PDF supera el tamaño máximo (10 MB).';
  return null;
}

/**
 * Selector del PDF adjunto de la oferta. `current` es el nombre del PDF ya guardado (edición);
 * `file` el pendiente de subir. Quitar el guardado se gestiona fuera (`onRemoveCurrent`).
 */
export function PdfField({
  file,
  onFile,
  current,
  onRemoveCurrent,
  error,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  current?: string | null;
  onRemoveCurrent?: () => void;
  error?: string | null;
}) {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label htmlFor={uid} className={labelClass}>
        PDF de la oferta (opcional)
      </label>
      {current && !file && (
        <div className="flex items-center gap-3 text-[13px] mb-2">
          <span className="truncate">{current}</span>
          {onRemoveCurrent && (
            <button type="button" className="text-[12px] text-[var(--danger)] font-medium" onClick={onRemoveCurrent}>
              Quitar
            </button>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        id={uid}
        type="file"
        accept="application/pdf,.pdf"
        className="block w-full text-[13px] file:mr-3 file:h-8 file:px-3 file:rounded-md file:border file:border-[var(--line-strong)] file:bg-[var(--bg-surface)] file:text-[12px] file:font-medium"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file && (
        <button
          type="button"
          className="text-[12px] text-[var(--ink-secondary)] mt-1.5"
          onClick={() => {
            onFile(null);
            if (inputRef.current) inputRef.current.value = '';
          }}
        >
          Quitar «{file.name}»
        </button>
      )}
      <p className="text-[11px] text-[var(--ink-tertiary)] mt-1">Solo PDF, hasta 10 MB. Solo lo ve RRHH/Administración.</p>
      {error && (
        <p role="alert" className="text-[12px] text-[var(--danger)] mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Detalle de la oferta, colapsado por defecto para no empujar el pipeline fuera de pantalla: un
 * extracto de 3 líneas (Objetivo del puesto; si no, el primer campo con contenido; si no, el texto
 * legado) y «Ver descripción completa», que despliega las secciones en la propia página. `description`
 * es LEGADO y solo se muestra si no hay ningún campo estructurado. El PDF se descarga solo con
 * `canDownloadPdf` y vive junto al extracto.
 */
export function DescripcionOferta({ job, canDownloadPdf }: { job: JobDetail; canDownloadPdf: boolean }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const secciones = CAMPOS_DESCRIPCION.filter(({ key }) => job[key]);
  const showPdf = canDownloadPdf && job.tienePdf;
  const extracto = secciones.length > 0 ? (job.objetivoPuesto || job[secciones[0]!.key]) : job.description;
  if (!extracto && !showPdf) return null;
  return (
    <section aria-label="Descripción de la oferta" className="mb-6 max-w-3xl">
      {extracto && (
        <>
          <p className={`text-[13px] text-[var(--ink-secondary)] leading-relaxed whitespace-pre-line ${open ? 'hidden' : 'line-clamp-3'}`}>
            {extracto}
          </p>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
            iconRight={<ChevronDown aria-hidden="true" className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
          >
            {open ? 'Ocultar descripción' : 'Ver descripción completa'}
          </Button>
          <div id={panelId} hidden={!open} className="mt-4">
            {secciones.length > 0 ? (
              secciones.map(({ key, label }) => (
                <div key={key} className="mb-5">
                  <h2 className="font-serif text-[15px] font-medium mb-1.5 pb-1.5 border-b border-[var(--line-subtle)]">{label}</h2>
                  <p className="text-[13px] text-[var(--ink-secondary)] whitespace-pre-line leading-relaxed">{job[key]}</p>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[var(--ink-secondary)] whitespace-pre-line leading-relaxed">{job.description}</p>
            )}
          </div>
        </>
      )}
      {showPdf && (
        <div className="mt-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => downloadFile(`/jobs/${job.id}/pdf`, job.descripcionPdfNombre ?? 'oferta.pdf')}
          >
            Descargar PDF{job.descripcionPdfNombre ? ` · ${job.descripcionPdfNombre}` : ''}
          </Button>
        </div>
      )}
    </section>
  );
}
