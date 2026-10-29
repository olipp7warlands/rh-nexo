import { Link } from 'react-router-dom';
import { Badge, Card } from '@nucleo/ui';
import { formatDate } from '../../lib/format';
import { roleLabel, useUsers } from './useUsers';
import { CuentaAccionesMenu } from './CuentaAccionesMenu';

/** Cuentas con acceso a la app (solo ADMIN). Solo lectura: la gestión vive en la pestaña «Acceso» de cada ficha. */
export function CuentasPage() {
  const { data: accounts, isLoading, error } = useUsers();
  const adminsActivos = (accounts ?? []).filter((a) => a.role === 'ADMIN' && a.isActive).length;

  return (
    <div>
      <p className="text-[13px] text-[var(--ink-tertiary)] mb-5">
        {accounts ? `${accounts.length} cuentas` : 'Cargando…'} · Cada cuenta tiene su menú de acciones; para dar acceso a una persona nueva, abre su ficha y la pestaña «Acceso».
      </p>
      {error && (
        <Card>
          <p role="alert" className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {isLoading && (
        <Card>
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando cuentas…</p>
        </Card>
      )}
      {accounts && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Persona', 'Email', 'Rol', 'Estado', 'Último acceso'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
                <th className="px-3 py-3">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)]">
                  <td className="px-5 py-3 font-medium">
                    {a.employee ? (
                      <Link to={`/personas/${a.employee.id}?tab=acceso`} className="hover:underline">
                        {a.employee.fullName}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--ink-secondary)]">{a.email}</td>
                  <td className="px-5 py-3">{roleLabel(a.role)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={a.isActive ? (a.mustChangePassword ? 'warning' : 'success') : 'neutral'}>
                      {!a.isActive ? 'Desactivada' : a.mustChangePassword ? 'Pendiente de primer acceso' : 'Activa'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 mono text-[var(--ink-secondary)]">{a.lastLogin ? formatDate(a.lastLogin) : 'Nunca'}</td>
                  <td className="px-3 py-3 text-right">
                    <CuentaAccionesMenu account={a} adminsActivos={adminsActivos} />
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    No hay cuentas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
