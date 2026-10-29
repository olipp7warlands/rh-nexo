import { useState } from 'react';
import { Button } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';

/**
 * Muestra la contraseña temporal UNA sola vez (alta o restablecimiento). No se cierra con Esc ni
 * con clic fuera: hay que confirmar que se ha anotado/entregado, porque no se podrá volver a ver.
 */
export function TemporaryPasswordModal({
  title,
  email,
  password,
  onClose,
}: {
  title: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [noted, setNoted] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false); // sin portapapeles (contexto no seguro): se puede seleccionar y copiar a mano
    }
  };

  return (
    <Modal
      title={title}
      subtitle={email}
      dismissible={false}
      onClose={onClose}
      footer={
        <Button variant="primary" type="button" onClick={onClose} disabled={!noted}>
          Cerrar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] text-[var(--ink-secondary)]">
          Entrégasela en mano a la persona. <strong className="font-medium">No se volverá a mostrar</strong> y no se envía por email.
          Tendrá que cambiarla en su primer acceso.
        </p>
        <div className="flex items-center gap-2">
          <output
            aria-label="Contraseña temporal"
            className="mono flex-1 select-all text-[18px] tracking-wider bg-[var(--bg-subtle)] border border-[var(--line-strong)] rounded-md px-3 py-2"
          >
            {password}
          </output>
          <Button variant="secondary" type="button" onClick={copy}>
            {copied ? 'Copiada ✓' : 'Copiar'}
          </Button>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} />
          La he anotado o entregado; entiendo que no se puede volver a ver.
        </label>
      </div>
    </Modal>
  );
}
