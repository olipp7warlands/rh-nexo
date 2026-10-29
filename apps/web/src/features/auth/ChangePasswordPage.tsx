import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input } from '@nucleo/ui';
import { useAuth } from './AuthContext';

const MIN_LENGTH = 12;
const MAX_BYTES = 72; // límite real de bcrypt; con acentos/emojis se mide en bytes, no en caracteres

/**
 * Cambio de contraseña propio. Con `mustChangePassword` (contraseña temporal) es la ÚNICA pantalla
 * accesible —sin menú, solo «Cerrar sesión»— y no tiene vuelta atrás; si no, es voluntario y se
 * puede cancelar. Las reglas se validan aquí para dar feedback inmediato; el servidor las repite.
 */
export function ChangePasswordPage() {
  const { user, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const forced = !!user?.mustChangePassword;

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const rules = [
    { ok: next.length >= MIN_LENGTH, label: `Al menos ${MIN_LENGTH} caracteres` },
    { ok: new TextEncoder().encode(next).length <= MAX_BYTES, label: `Como máximo ${MAX_BYTES} bytes` },
    { ok: next.length > 0 && next !== current, label: 'Distinta de la actual' },
    { ok: next.length > 0 && next.toLowerCase() !== (user?.email ?? '').toLowerCase(), label: 'No es tu email' },
    { ok: next.length > 0 && next === repeat, label: 'Las dos contraseñas coinciden' },
  ];
  const valid = current.length > 0 && rules.every((r) => r.ok);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setServerError(null);
    try {
      await changePassword(current, next);
      navigate('/', { replace: true });
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const type = show ? 'text' : 'password';
  const labelClass = 'block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5';

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--bg-canvas)] px-4">
      <div className="w-full max-w-[420px]">
        <div className="bg-[var(--bg-surface)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-md)] p-7">
          <h1 className="font-serif text-[18px] font-medium tracking-[-0.01em] mb-1">
            {forced ? 'Elige tu contraseña' : 'Cambiar contraseña'}
          </h1>
          <p className="text-[13px] text-[var(--ink-secondary)] mb-6">
            {forced
              ? 'Estás usando una contraseña temporal. Debes cambiarla antes de continuar.'
              : 'Al cambiarla se cerrarán tus otras sesiones abiertas.'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="pw-actual" className={labelClass}>
                {forced ? 'Contraseña temporal' : 'Contraseña actual'}
              </label>
              <Input id="pw-actual" type={type} autoComplete="current-password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pw-nueva" className={labelClass}>
                Nueva contraseña
              </label>
              <Input id="pw-nueva" type={type} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-reglas" />
            </div>
            <div>
              <label htmlFor="pw-repetir" className={labelClass}>
                Repite la nueva contraseña
              </label>
              <Input id="pw-repetir" type={type} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </div>

            <label className="flex items-center gap-2 text-[12px] text-[var(--ink-secondary)]">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Mostrar contraseñas
            </label>

            <ul id="pw-reglas" aria-label="Requisitos de la contraseña" className="text-[12px] flex flex-col gap-1">
              {rules.map((r) => (
                <li key={r.label} className={r.ok ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)]'}>
                  <span aria-hidden="true">{r.ok ? '✓' : '○'}</span> {r.label}
                  <span className="sr-only">{r.ok ? ' (cumplido)' : ' (pendiente)'}</span>
                </li>
              ))}
            </ul>

            {serverError && (
              <div role="alert" className="text-[12px] text-[var(--danger)] bg-[var(--danger-soft)] rounded-md px-3 py-2">
                {serverError}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={!valid || busy} className="w-full mt-1">
              {busy ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </div>

        <p className="text-[12px] text-center mt-5">
          {forced ? (
            <button type="button" onClick={logout} className="text-[var(--ink-secondary)] hover:underline">
              Cerrar sesión
            </button>
          ) : (
            <Link to="/" className="text-[var(--ink-secondary)] hover:underline">
              Cancelar y volver
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
