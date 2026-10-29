import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { Button } from '@nucleo/ui';
import { Modal } from './Modal';

export interface MenuAction {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** Si existe, el elemento queda inhabilitado (sigue siendo enfocable) y muestra este motivo. */
  disabledReason?: string;
}

const MENU_WIDTH = 240;

/**
 * Menú de tres puntos operable por teclado (patrón WAI-ARIA «menu button»): Enter/Espacio/↓ abre,
 * ↑↓/Inicio/Fin navegan, Esc cierra y devuelve el foco, Tab cierra. Los elementos inhabilitados
 * usan aria-disabled (siguen enfocables para que el motivo sea legible) y no ejecutan nada.
 *
 * El menú se pinta en un portal con posición fija, así que no lo recortan las tarjetas con
 * `overflow-hidden` ni las tablas; se abre hacia arriba si no cabe debajo y se cierra al hacer
 * scroll o redimensionar.
 */
export function AccionesMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // Posición: alineado a la derecha del botón; si no cabe debajo, encima.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? 0;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = r.bottom + 4;
    const top = below + h > window.innerHeight - 8 && r.top - h - 4 > 8 ? r.top - h - 4 : below;
    setPos({ top, left });
  }, [open, actions.length]);

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const focusItem = (i: number) => {
    const n = actions.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const onMenuKey = (e: KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === 'ArrowDown') (e.preventDefault(), focusItem(current + 1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), focusItem(current - 1));
    else if (e.key === 'Home') (e.preventDefault(), focusItem(0));
    else if (e.key === 'End') (e.preventDefault(), focusItem(actions.length - 1));
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close(true));
    else if (e.key === 'Tab') close(false);
  };

  return (
    // El contenedor frena el clic para que no active la navegación de la tarjeta/fila.
    <div ref={rootRef} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) (e.preventDefault(), setOpen(true));
        }}
        className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)]"
      >
        <MoreVertical size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            // Los eventos de un portal burbujean por el árbol de React: se frena el clic para que no llegue a la fila.
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, width: MENU_WIDTH, visibility: pos ? 'visible' : 'hidden' }}
            className="z-[60] bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-lg shadow-lg py-1"
          >
            {actions.map((a, i) => (
              <button
                key={a.key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={a.disabledReason ? true : undefined}
                title={a.disabledReason}
                onClick={() => {
                  if (a.disabledReason) return;
                  close(false);
                  a.onSelect();
                }}
                className={`w-full text-left px-3 py-2 text-[13px] focus:outline-none focus:bg-[var(--bg-hover)] ${
                  a.disabledReason
                    ? 'text-[var(--ink-disabled)] cursor-not-allowed'
                    : a.danger
                      ? 'text-[var(--danger)] hover:bg-[var(--danger-soft)] focus:bg-[var(--danger-soft)]'
                      : 'text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {a.label}
                {a.disabledReason && <span className="block text-[11px] text-[var(--ink-tertiary)] mt-0.5">{a.disabledReason}</span>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Diálogo de confirmación: nombra lo que se va a hacer. Por defecto es un borrado. */
export function ConfirmarEliminarModal({
  title,
  message,
  pending,
  error,
  onConfirm,
  onClose,
  confirmLabel = 'Eliminar',
  pendingLabel = 'Eliminando…',
  variant = 'danger',
}: {
  title: string;
  message: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel?: string;
  pendingLabel?: string;
  variant?: 'danger' | 'primary';
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant={variant} type="button" onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-[var(--ink-secondary)]">{message}</p>
      {error && (
        <div role="alert" className="mt-3 text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </Modal>
  );
}

/** Texto de motivo para un «Eliminar» inhabilitado por referencias: «En uso por 2 personas y 1 oferta…». */
export function razonEnUso(refs: [n: number | undefined, singular: string, plural: string][]): string | undefined {
  const con = refs.filter(([n]) => (n ?? 0) > 0).map(([n, s, p]) => `${n} ${n === 1 ? s : p}`);
  if (con.length === 0) return undefined;
  const lista = con.length === 1 ? con[0]! : `${con.slice(0, -1).join(', ')} y ${con[con.length - 1]}`;
  return `En uso por ${lista}: resuélvelo antes de eliminar.`;
}

/**
 * Acciones de una fila de listado: las `extra` propias de cada listado, luego «Editar» y «Eliminar».
 * «Eliminar» pide confirmación en un modal (nada de window.confirm) y muestra ahí el error del
 * servidor (p. ej. un 409 con su motivo). Si `disabledReason` existe, queda inhabilitado y lo explica.
 */
export function FilaAcciones({
  label,
  onEdit,
  extra = [],
  eliminar,
}: {
  label: string;
  onEdit?: () => void;
  extra?: MenuAction[];
  eliminar?: {
    title: string;
    message: string;
    disabledReason?: string;
    onConfirm: () => Promise<unknown>;
  };
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actions: MenuAction[] = [...extra];
  if (onEdit) actions.push({ key: 'editar', label: 'Editar', onSelect: onEdit });
  if (eliminar) {
    actions.push({
      key: 'eliminar',
      label: 'Eliminar',
      danger: true,
      disabledReason: eliminar.disabledReason,
      onSelect: () => {
        setError(null);
        setConfirming(true);
      },
    });
  }
  if (actions.length === 0) return null;

  return (
    <>
      <AccionesMenu label={label} actions={actions} />
      {confirming && eliminar && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmarEliminarModal
            title={eliminar.title}
            message={eliminar.message}
            pending={pending}
            error={error}
            onClose={() => setConfirming(false)}
            onConfirm={async () => {
              setPending(true);
              setError(null);
              try {
                await eliminar.onConfirm();
                setConfirming(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          />
        </div>
      )}
    </>
  );
}
