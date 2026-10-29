import type { Holiday } from './useAbsences';

/** Ámbito legible de un festivo: «España» (país) o «Madrid · España» (localización). */
export function ambitoLabel(h: Pick<Holiday, 'pais' | 'localizacion'>): { tipo: 'País' | 'Local'; nombre: string } {
  if (h.localizacion) {
    return { tipo: 'Local', nombre: [h.localizacion.nombre, h.localizacion.pais?.nombre].filter(Boolean).join(' · ') };
  }
  return { tipo: 'País', nombre: h.pais?.nombre ?? 'Sin ámbito' };
}

/**
 * Estado de revisión de un festivo. Se distingue por FORMA además de por texto (nunca solo por color):
 * ○ pendiente de validación · ● validado · ◇ fecha aproximada (se puede combinar con ○/●).
 */
export function holidayMarks(h: Pick<Holiday, 'validado' | 'aproximado'>) {
  return [
    h.validado
      ? { key: 'validado', glyph: '●', label: 'Validado' }
      : { key: 'pendiente', glyph: '○', label: 'Pendiente de validación' },
    ...(h.aproximado ? [{ key: 'aproximado', glyph: '◇', label: 'Fecha aproximada' }] : []),
  ];
}

export function HolidayMarks({ holiday }: { holiday: Pick<Holiday, 'validado' | 'aproximado'> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {holidayMarks(holiday).map((m) => (
        <span key={m.key} className="inline-flex items-center gap-1 text-[12px] text-[var(--ink-secondary)]">
          <span aria-hidden="true">{m.glyph}</span>
          {m.label}
        </span>
      ))}
    </span>
  );
}
