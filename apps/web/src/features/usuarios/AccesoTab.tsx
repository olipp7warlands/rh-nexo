import { useState } from 'react';
import { Badge, Button, Card } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { formatDate } from '../../lib/format';
import type { Employee } from '../employees/useEmployees';
import { ConfirmarEliminarModal } from '../_shared/AccionesMenu';
import { TemporaryPasswordModal } from './TemporaryPasswordModal';
import {
  ROLE_OPTIONS,
  roleLabel,
  useChangeRole,
  useDeactivateUser,
  useGiveAccess,
  useReactivateUser,
  useResetPassword,
  useUsers,
  type UserAccount,
  type WithTemporaryPassword,
} from './useUsers';
import type { Role } from '../auth/AuthContext';

const selectClass =
  'h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

type Pending = { kind: 'deactivate' } | { kind: 'reset' } | { kind: 'give' } | null;

/**
 * Pestaña «Acceso» de la ficha (solo ADMIN): dar acceso a la app, cambiar rol, desactivar/reactivar
 * y restablecer contraseña. Las acciones prohibidas sobre la propia cuenta salen inhabilitadas con
 * el motivo visible (aria-disabled) y el servidor las rechaza igual.
 */
export function AccesoTab({ employee }: { employee: Employee }) {
  const { user: me } = useAuth();
  const { data: accounts, isLoading, error } = useUsers(employee.id);
  const account = accounts?.[0];

  const give = useGiveAccess();
  const changeRole = useChangeRole();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();
  const reset = useResetPassword();

  const [role, setRole] = useState<Role>('EMPLEADO');
  const [roleDraft, setRoleDraft] = useState<Role | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [shown, setShown] = useState<{ title: string; data: WithTemporaryPassword } | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const isSelf = !!account && account.id === me?.id;
  const fail = (e: unknown) => setMessage({ type: 'error', text: (e as Error).message });

  if (isLoading) return <p className="text-[13px] text-[var(--ink-tertiary)]">Cargando acceso…</p>;
  if (error) return <p role="alert" className="text-[13px] text-[var(--danger)]">No se pudo cargar: {(error as Error).message}</p>;

  // ── Sin cuenta ───────────────────────────────────────────────
  if (!account) {
    const baja = employee.status === 'BAJA';
    return (
      <Card className="max-w-xl">
        <h2 className="font-serif text-[15px] font-medium mb-1">Acceso a la aplicación</h2>
        <p className="text-[13px] text-[var(--ink-secondary)] mb-4">
          {employee.fullName} no tiene cuenta. Al darle acceso se crea con su email de la ficha y una contraseña temporal que verás una
          sola vez.
        </p>
        <dl className="text-[13px] mb-4">
          <dt className="text-[12px] text-[var(--ink-tertiary)]">Email de acceso</dt>
          <dd className="mb-3">{employee.email}</dd>
        </dl>
        <label htmlFor="acceso-rol" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
          Rol
        </label>
        <select id="acceso-rol" className={`${selectClass} w-60 mb-4`} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {baja && <p className="text-[12px] text-[var(--ink-secondary)] mb-3">Esta persona está dada de baja: no se le puede dar acceso.</p>}
        {message && (
          <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-[12px] mb-3 ${message.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--ink-secondary)]'}`}>
            {message.text}
          </p>
        )}
        <div>
          <Button variant="primary" type="button" disabled={baja || give.isPending} onClick={() => { setMessage(null); setPending({ kind: 'give' }); }}>
            Dar acceso
          </Button>
        </div>

        {pending?.kind === 'give' && (
          <ConfirmarEliminarModal
            title="Dar acceso"
            confirmLabel="Dar acceso"
            pendingLabel="Creando…"
            variant="primary"
            message={`Se creará la cuenta de ${employee.fullName} (${employee.email}) con el rol ${roleLabel(role)} y una contraseña temporal que se mostrará una sola vez.`}
            pending={give.isPending}
            error={dialogError}
            onClose={() => { setPending(null); setDialogError(null); }}
            onConfirm={() =>
              give.mutate(
                { employeeId: employee.id, role },
                {
                  onSuccess: (data) => {
                    setPending(null);
                    setDialogError(null);
                    setShown({ title: 'Contraseña inicial', data });
                  },
                  onError: (e) => setDialogError((e as Error).message),
                },
              )
            }
          />
        )}
        {shown && <TemporaryPasswordModal title={shown.title} email={shown.data.user.email} password={shown.data.temporaryPassword} onClose={() => setShown(null)} />}
      </Card>
    );
  }

  // ── Con cuenta ───────────────────────────────────────────────
  const selfReason = 'No puedes hacerlo sobre tu propia cuenta.';
  const draft = roleDraft ?? account.role;
  const estado = !account.isActive ? 'Desactivada' : account.mustChangePassword ? 'Pendiente de primer acceso' : 'Activa';

  const saveRole = () => {
    setMessage(null);
    changeRole.mutate(
      { id: account.id, role: draft },
      { onSuccess: () => { setRoleDraft(null); setMessage({ type: 'ok', text: 'Rol actualizado.' }); }, onError: fail },
    );
  };

  return (
    <Card className="max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-[15px] font-medium">Acceso a la aplicación</h2>
        <Badge variant={account.isActive ? (account.mustChangePassword ? 'warning' : 'success') : 'neutral'}>{estado}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] mb-5">
        <div>
          <dt className="text-[12px] text-[var(--ink-tertiary)]">Email de acceso</dt>
          <dd>{account.email}</dd>
        </div>
        <div>
          <dt className="text-[12px] text-[var(--ink-tertiary)]">Último acceso</dt>
          <dd>{account.lastLogin ? formatDate(account.lastLogin) : 'Nunca'}</dd>
        </div>
      </dl>

      <div className="flex items-end gap-2 mb-5">
        <div>
          <label htmlFor="acceso-rol" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Rol
          </label>
          <select
            id="acceso-rol"
            className={`${selectClass} w-60`}
            value={draft}
            disabled={isSelf}
            aria-describedby={isSelf ? 'acceso-self' : undefined}
            onChange={(e) => setRoleDraft(e.target.value as Role)}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" type="button" disabled={isSelf || draft === account.role || changeRole.isPending} onClick={saveRole}>
          {changeRole.isPending ? 'Guardando…' : 'Guardar rol'}
        </Button>
      </div>
      {isSelf && (
        <p id="acceso-self" className="text-[12px] text-[var(--ink-secondary)] bg-[var(--bg-subtle)] rounded-md px-3 py-2 mb-4">
          Esta es tu cuenta. No puedes cambiarte el rol, desactivarte ni restablecer tu contraseña desde aquí; para cambiarla usa «Cambiar
          contraseña» en el menú lateral.
        </p>
      )}

      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-[12px] mb-3 ${message.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--ink-secondary)]'}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {account.isActive ? (
          <Button
            variant="secondary"
            type="button"
            aria-disabled={isSelf || undefined}
            title={isSelf ? selfReason : undefined}
            onClick={() => { if (isSelf) return; setMessage(null); setPending({ kind: 'deactivate' }); }}
            className={isSelf ? 'opacity-50 cursor-not-allowed' : ''}
          >
            Desactivar cuenta
          </Button>
        ) : (
          <Button
            variant="secondary"
            type="button"
            disabled={reactivate.isPending}
            onClick={() => { setMessage(null); reactivate.mutate(account.id, { onSuccess: () => setMessage({ type: 'ok', text: 'Cuenta reactivada.' }), onError: fail }); }}
          >
            Reactivar cuenta
          </Button>
        )}
        <Button
          variant="secondary"
          type="button"
          aria-disabled={isSelf || undefined}
          title={isSelf ? selfReason : undefined}
          onClick={() => { if (isSelf) return; setMessage(null); setPending({ kind: 'reset' }); }}
          className={isSelf ? 'opacity-50 cursor-not-allowed' : ''}
        >
          Restablecer contraseña
        </Button>
      </div>

      {pending?.kind === 'deactivate' && (
        <ConfirmarEliminarModal
          title="Desactivar cuenta"
          confirmLabel="Desactivar"
          pendingLabel="Desactivando…"
          message={`¿Desactivar la cuenta de ${employee.fullName}? Se cerrarán sus sesiones y no podrá entrar hasta que la reactives. La cuenta no se borra.`}
          pending={deactivate.isPending}
          error={dialogError}
          onClose={() => { setPending(null); setDialogError(null); }}
          onConfirm={() =>
            deactivate.mutate(account.id, {
              onSuccess: () => { setPending(null); setDialogError(null); setMessage({ type: 'ok', text: 'Cuenta desactivada.' }); },
              onError: (e) => setDialogError((e as Error).message),
            })
          }
        />
      )}
      {pending?.kind === 'reset' && (
        <ConfirmarEliminarModal
          title="Restablecer contraseña"
          confirmLabel="Restablecer"
          pendingLabel="Restableciendo…"
          message={`Se generará una contraseña temporal nueva para ${employee.fullName}, que verás una sola vez. Se cerrarán sus sesiones y tendrá que cambiarla al entrar.`}
          pending={reset.isPending}
          error={dialogError}
          onClose={() => { setPending(null); setDialogError(null); }}
          onConfirm={() =>
            reset.mutate(account.id, {
              onSuccess: (data: WithTemporaryPassword) => { setPending(null); setDialogError(null); setShown({ title: 'Contraseña restablecida', data }); },
              onError: (e) => setDialogError((e as Error).message),
            })
          }
        />
      )}
      {shown && <TemporaryPasswordModal title={shown.title} email={shown.data.user.email} password={shown.data.temporaryPassword} onClose={() => setShown(null)} />}
    </Card>
  );
}

export type { UserAccount };
