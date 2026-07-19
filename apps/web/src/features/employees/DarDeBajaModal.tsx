import { useState } from 'react';
import { Button, Input } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { useBajaEmployee } from './useEmployees';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DarDeBajaModal({ employee, onClose }: { employee: { id: string; fullName: string }; onClose: () => void }) {
  const baja = useBajaEmployee(employee.id);
  const [fecha, setFecha] = useState(todayISO());
  const [serverError, setServerError] = useState<string | null>(null);

  const pending = baja.isPending;

  const onConfirm = async () => {
    setServerError(null);
    try {
      await baja.mutateAsync(fecha);
      onClose();
    } catch (e) {
      setServerError((e as Error).message);
    }
  };

  return (
    <Modal
      title={`Dar de baja a ${employee.fullName}`}
      subtitle="Inicia su proceso de offboarding (con la plantilla activa) y marca la baja. Conserva el histórico."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending}>
            {pending ? 'Procesando…' : 'Confirmar baja'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">Fecha de baja</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <p className="text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2.5">
          Esta acción crea un proceso de <strong>Offboarding</strong> para {employee.fullName} (visible en Procesos) y cambia
          su estado a <strong>Baja</strong>. Ambas acciones quedan auditadas.
        </p>
        {serverError && (
          <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
            {serverError}
          </div>
        )}
      </div>
    </Modal>
  );
}
