import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Diálogo modal accesible: rol dialog, cierre con Esc y clic en el fondo, foco al abrir. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
  dismissible = true,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** false: no se cierra con Esc, clic fuera ni la X (p. ej. una contraseña que solo se muestra una vez). */
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, dismissible]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(10,10,10,0.45)] p-4 sm:p-8"
      onMouseDown={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full text-left ${wide ? 'max-w-3xl' : 'max-w-xl'} my-auto bg-[var(--bg-surface)] rounded-xl shadow-[var(--shadow-md)] outline-none`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[var(--line)]">
          <div>
            <h2 className="font-serif text-[16px] font-medium tracking-[-0.01em]">{title}</h2>
            {subtitle && <p className="text-[12px] text-[var(--ink-secondary)] mt-0.5">{subtitle}</p>}
          </div>
          {dismissible && (
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 rounded-md text-[var(--ink-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--line)] bg-[var(--bg-subtle)] rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
