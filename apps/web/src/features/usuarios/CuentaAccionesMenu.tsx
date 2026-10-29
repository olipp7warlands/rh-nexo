import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@nucleo/ui';
import { AccionesMenu, ConfirmarEliminarModal, type MenuAction } from '../_shared/AccionesMenu';
import { Modal } from '../_shared/Modal';
import { useAuth, type Role } from '../auth/AuthContext';
import { TemporaryPasswordModal } from './TemporaryPasswordModal';
import {
  ROLE_OPTIONS,
  roleLabel,
  useChangeRole,
  useDeactivateUser,
  useReactivateUser,
  useResetPassword,
  type UserAccount,
  type WithTemporaryPassword,
} from './useUsers';

const selectClass =
  'h-9 px-3 w-full bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

type Dialog = 'rol' | 'desactivar' | 'reset' | null;

/**
 * Acciones de una cuenta (solo ADMIN) desde la lista de Cuentas: la ÚNICA vía de gestión para cuentas
 * sin ficha. Respeta las protecciones del servidor y las adelanta con su motivo visible: no sobre la
 * propia cuenta y nunca dejar el sistema sin un ADMIN activo (`adminsActivos` sale de la propia lista).
 */
export function CuentaAccionesMenu({ account, adminsActivos }: { account: UserAccount; adminsActivos: number }) {
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const changeRole = useChangeRole();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const reset = useResetPassword();

  const [dialog, setDialog] = useState<Dialog>(null);
  const [role, setRole] = useState<Role>(account.role);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shown, setShown] = useState<WithTemporaryPassword | null>(null);

  const isSelf = account.id === me?.id;
  const ultimoAdmin = account.role === 'ADMIN' && account.isActive && adminsActivos <= 1;
  const SELF = 'No puedes hacerlo sobre tu propia cuenta.';
  const ULTIMO = 'Es el último ADMIN activo: el sistema no puede quedarse sin uno.';

  const open = (d: Dialog) => {
    setError(null);
    setMessage(null);
    setRole(account.role);
    setDialog(d);
  };

  const actions: MenuAction[] = [];
  if (account.employeeId) {
    actions.push({ key: 'ficha', label: 'Abrir ficha', onSelect: () => navigate(`/personas/${account.employeeId}?tab=acceso`) });
  }
  actions.push({ key: 'rol', label: 'Cambiar rol', onSelect: () => open('rol'), disabledReason: isSelf ? SELF : ultimoAdmin ? ULTIMO : undefined });
  if (account.isActive) {
    actions.push({ key: 'desactivar', label: 'Desactivar cuenta', onSelect: () => open('desactivar'), disabledReason: isSelf ? SELF : ultimoAdmin ? ULTIMO : undefined });
  } else {
    actions.push({
      key: 'reactivar',
      label: 'Reactivar cuenta',
      onSelect: () => {
        setMessage(null);
        reactivate.mutate(account.id, { onSuccess: () => setMessage('Cuenta reactivada.'), onError: (e) => setMessage((e as Error).message) });
      },
    });
  }
  actions.push({ key: 'reset', label: 'Restablecer contraseña', onSelect: () => open('reset'), disabledReason: isSelf ? 'Para cambiar tu propia contraseña usa «Cambiar contraseña» en el menú lateral.' : undefined });

  const nombre = account.employee?.fullName ?? account.email;
  const cerrar = () => setDialog(null);

  return (
    <>
      <AccionesMenu label={`Acciones de la cuenta de ${nombre}`} actions={actions} />
      {message && (
        <span role="status" className="block text-[11px] text-[var(--ink-secondary)] mt-1 max-w-[220px] ml-auto">
          {message}
        </span>
      )}
      <div onClick={(e) => e.stopPropagation()}>
        {dialog === 'rol' && (
          <Modal
            title="Cambiar rol"
            subtitle={account.email}
            onClose={cerrar}
            footer={
              <>
                <Button variant="ghost" type="button" onClick={cerrar}>
                  Cancelar
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  disabled={role === account.role || changeRole.isPending}
                  onClick={() =>
                    changeRole.mutate(
                      { id: account.id, role },
                      { onSuccess: () => { cerrar(); setMessage(`Rol cambiado a ${roleLabel(role)}.`); }, onError: (e) => setError((e as Error).message) },
                    )
                  }
                >
                  {changeRole.isPending ? 'Guardando…' : 'Guardar rol'}
                </Button>
              </>
            }
          >
            <label htmlFor={`rol-${account.id}`} className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
              Rol de {nombre}
            </label>
            <select id={`rol-${account.id}`} className={selectClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {error && (
              <div role="alert" className="mt-3 text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
                {error}
              </div>
            )}
          </Modal>
        )}
        {dialog === 'desactivar' && (
          <ConfirmarEliminarModal
            title="Desactivar cuenta"
            confirmLabel="Desactivar"
            pendingLabel="Desactivando…"
            message={`¿Desactivar la cuenta de ${nombre}? Se cerrarán sus sesiones y no podrá entrar hasta que la reactives. La cuenta no se borra.`}
            pending={deactivate.isPending}
            error={error}
            onClose={cerrar}
            onConfirm={() =>
              deactivate.mutate(account.id, {
                onSuccess: () => { cerrar(); setMessage('Cuenta desactivada.'); },
                onError: (e) => setError((e as Error).message),
              })
            }
          />
        )}
        {dialog === 'reset' && (
          <ConfirmarEliminarModal
            title="Restablecer contraseña"
            confirmLabel="Restablecer"
            pendingLabel="Restableciendo…"
            message={`Se generará una contraseña temporal nueva para ${nombre}, que verás una sola vez. Se cerrarán sus sesiones y tendrá que cambiarla al entrar.`}
            pending={reset.isPending}
            error={error}
            onClose={cerrar}
            onConfirm={() =>
              reset.mutate(account.id, {
                onSuccess: (data) => { cerrar(); setShown(data); },
                onError: (e) => setError((e as Error).message),
              })
            }
          />
        )}
        {shown && <TemporaryPasswordModal title="Contraseña restablecida" email={shown.user.email} password={shown.temporaryPassword} onClose={() => setShown(null)} />}
      </div>
    </>
  );
}
