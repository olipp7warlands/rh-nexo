import { useState } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Button, Input } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useCreatePais, usePaises } from './useEstructura';

const selectClass =
  'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all';

/**
 * Desplegable de País con alta en línea («+ Nuevo país»), mismo patrón que el «+ Nueva» de
 * localización en el alta de persona: alterna entre el <select> y una mini-fila (nombre + Crear + ✕)
 * y selecciona el país creado vía `onCreated`. El botón solo se ofrece a ADMIN/RRHH (el servidor lo
 * exige igual).
 */
export function PaisSelectField({
  label,
  required,
  error,
  registerReturn,
  onCreated,
}: {
  label: string;
  required?: boolean;
  error?: string;
  registerReturn: UseFormRegisterReturn;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const { data: paises } = usePaises();
  const create = useCreatePais();
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const submit = async () => {
    if (!nombre.trim()) return setCreateError('Indica el nombre del país.');
    setCreateError(null);
    try {
      const created = await create.mutateAsync({ nombre: nombre.trim() });
      onCreated(created.id);
      setCreating(false);
      setNombre('');
    } catch (e) {
      setCreateError((e as Error).message);
    }
  };

  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5" htmlFor={registerReturn.name}>
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </label>
      {!creating ? (
        <div className="flex items-center gap-2">
          <select id={registerReturn.name} className={selectClass} {...registerReturn}>
            <option value="">—</option>
            {paises?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          {canCreate && (
            <Button variant="secondary" type="button" size="sm" onClick={() => setCreating(true)}>
              + Nuevo país
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            aria-label="Nombre del nuevo país"
            placeholder="Nombre del país"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <Button variant="secondary" type="button" size="sm" onClick={submit} disabled={create.isPending}>
            Crear
          </Button>
          <Button variant="ghost" type="button" size="sm" aria-label="Cancelar nuevo país" onClick={() => setCreating(false)}>
            ✕
          </Button>
        </div>
      )}
      {createError && (
        <p role="alert" className="text-[12px] text-[var(--danger)] mt-1.5">
          {createError}
        </p>
      )}
      {error && <p className="text-[12px] text-[var(--danger)] mt-1.5">{error}</p>}
    </div>
  );
}
