import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useEmployee } from '../employees/useEmployees';
import { useAbsences } from './useAbsences';
import { ApprovalQueue } from './ApprovalQueue';
import { AbsenceStatusBadge, AbsenceTypeBadge } from './AbsenceBadges';
import { formatDate } from '../../lib/format';

export function InicioPage() {
  const { user } = useAuth();
  const canApprove = user?.role === 'MANAGER' || user?.role === 'RRHH' || user?.role === 'ADMIN';
  const name = user?.employee?.fullName?.split(' ')[0] ?? '';

  const { data: me } = useEmployee(user?.employeeId ?? '');
  const { data: absences } = useAbsences();
  const balance = me?.balances?.find((b) => b.year === new Date().getFullYear()) ?? me?.balances?.[0];
  const mine = (absences ?? []).filter((a) => a.employeeId === user?.employeeId).slice(0, 4);

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow={`Hola, ${name}`} title="Inicio" subtitle="El pulso de tu día en el grupo." />

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 flex flex-col gap-5">
          {canApprove ? (
            <ApprovalQueue />
          ) : (
            <Card padding="p-0">
              <div className="px-5 py-4 border-b border-[var(--line)]">
                <h3 className="text-[14px] font-semibold">Mis solicitudes recientes</h3>
              </div>
              {mine.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">
                  No tienes solicitudes. Crea una desde <Link to="/ausencias" className="text-[var(--accent-ink)]">Ausencias</Link>.
                </p>
              ) : (
                <div className="divide-y divide-[var(--line-subtle)]">
                  {mine.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <AbsenceTypeBadge type={a.type} />
                      <span className="flex-1 text-[12px] text-[var(--ink-secondary)]">
                        {formatDate(a.startDate)} – {formatDate(a.endDate)}
                      </span>
                      <AbsenceStatusBadge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <h3 className="text-[14px] font-semibold mb-1">Mi saldo de vacaciones</h3>
            {balance ? (
              <>
                <div className="mono text-[28px] font-bold leading-tight mt-2">
                  {balance.total - balance.used}
                  <span className="text-[14px] text-[var(--ink-tertiary)] font-medium"> / {balance.total} días</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-hover)] mt-3 overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)]"
                    style={{ width: `${Math.min(100, (balance.used / Math.max(1, balance.total)) * 100)}%` }}
                  />
                </div>
                <Link to="/ausencias" className="inline-block mt-3 text-[12px] text-[var(--accent-ink)]">
                  Gestionar ausencias →
                </Link>
              </>
            ) : (
              <p className="text-[13px] text-[var(--ink-tertiary)] mt-2">Sin saldo registrado.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
