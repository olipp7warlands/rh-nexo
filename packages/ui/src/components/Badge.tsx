import type { ReactNode } from 'react';
import { cn } from '../cn';

type Variant = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'accent';

/**
 * Editorial (monocromo): cada estado se distingue por RELLENO vs CONTORNO y por contraste de
 * gris, nunca por matiz — es el único requisito de accesibilidad-sin-color de este sistema.
 *   success  → punto negro relleno       (Activo, Aprobada… — positivo/completo)
 *   info     → punto gris medio relleno  (Onboarding, En proceso… — en curso)
 *   warning  → punto hueco (contorno)    (Ausente, Pendiente… — requiere atención)
 *   neutral  → punto gris claro relleno  (Baja, Borrador… — inactivo/apagado)
 *   danger   → píldora invertida (negra) (Rechazada, Descartado… — negativo/final)
 */
const styles: Record<Variant, { pill: string; dot: string }> = {
  success: { pill: 'bg-[var(--bg-subtle)] text-[var(--ink-primary)]', dot: 'bg-[var(--ink-primary)]' },
  info: { pill: 'bg-[var(--bg-subtle)] text-[var(--info)]', dot: 'bg-[var(--info)]' },
  warning: {
    pill: 'bg-[var(--bg-subtle)] text-[var(--ink-secondary)]',
    dot: 'bg-transparent border-[1.5px] border-[var(--ink-primary)]',
  },
  // El punto es puro adorno (ink-disabled, sin garantía de contraste de texto); la etiqueta
  // sí es texto que hay que leer, así que usa ink-tertiary (legible).
  neutral: { pill: 'bg-[var(--bg-subtle)] text-[var(--ink-tertiary)]', dot: 'bg-[var(--ink-disabled)]' },
  danger: { pill: 'bg-[var(--ink-primary)] text-white font-semibold', dot: 'bg-white' },
  accent: { pill: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]', dot: 'bg-[var(--accent-ink)]' },
};

export function Badge({ variant = 'neutral', dot = false, children, className }: { variant?: Variant; dot?: boolean; children: ReactNode; className?: string }) {
  const s = styles[variant];
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-[22px] px-2.5 text-[11px] font-medium rounded-full leading-none', s.pill, className)}>
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />}
      {children}
    </span>
  );
}
