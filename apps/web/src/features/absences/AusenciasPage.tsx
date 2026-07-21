import { useState } from 'react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useEmployee } from '../employees/useEmployees';
import { downloadFile } from '../../lib/api';
import { useAbsences } from './useAbsences';
import { ApprovalQueue } from './ApprovalQueue';
import { NuevaAusenciaModal } from './NuevaAusenciaModal';
import { AbsenceStatusBadge, AbsenceTypeBadge } from './AbsenceBadges';
import { formatDate } from '../../lib/format';

export function AusenciasPage() {
  const { user } = useAuth();
  const canApprove = user?.role === 'MANAGER' || user?.role === 'RRHH' || user?.role === 'ADMIN';
  const [requesting, setRequesting] = useState(false);

  const { data: me } = useEmployee(user?.employeeId ?? '');
  const { data: absences, isLoading } = useAbsences();
  const balance = me?.balances?.find((b) => b.year === new Date().getFullYear()) ?? me?.balances?.[0];
  const mine = (absences ?? []).filter((a) => a.employeeId === user?.employeeId);

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Tiempo"
        title="Ausencias"
        subtitle="Solicita, revisa y aprueba ausencias del equipo."
        actions={
          <>
            {canApprove && (
              <Button variant="secondary" onClick={() => downloadFile('/absences/export', 'ausencias.csv')}>
                Exportar
              </Button>
            )}
            {user?.employeeId && (
              <Button variant="primary" onClick={() => setRequesting(true)}>
                Nueva solicitud
              </Button>
            )}
          </>
        }
      />

      {canApprove && (
        <div className="mb-6">
          <ApprovalQueue />
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Mi saldo */}
        <Card>
          <h3 className="font-serif text-[14px] font-medium mb-1">Mi saldo {balance?.year ?? new Date().getFullYear()}</h3>
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
              <p className="text-[11px] text-[var(--ink-tertiary)] mt-2">
                {balance.used} usados · {balance.pending} pendientes
              </p>
            </>
          ) : (
            <p className="text-[13px] text-[var(--ink-tertiary)] mt-2">Sin saldo registrado.</p>
          )}
        </Card>

        {/* Mis solicitudes */}
        <Card padding="p-0" className="col-span-2">
          <div className="px-5 py-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-[14px] font-medium">Mis solicitudes</h3>
          </div>
          {isLoading && <p className="px-5 py-6 text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>}
          {absences && mine.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">Aún no has solicitado ausencias.</p>
          )}
          <div className="divide-y divide-[var(--line-subtle)]">
            {mine.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <div className="text-[13px] font-medium flex items-center gap-2">
                    <AbsenceTypeBadge type={a.type} />
                    <span className="text-[var(--ink-secondary)]">
                      {formatDate(a.startDate)} – {formatDate(a.endDate)}
                    </span>
                  </div>
                  {a.reason && <div className="text-[12px] text-[var(--ink-tertiary)] mt-0.5">{a.reason}</div>}
                </div>
                <span className="mono text-[12px] text-[var(--ink-secondary)]">{a.days}d</span>
                <AbsenceStatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {requesting && <NuevaAusenciaModal onClose={() => setRequesting(false)} />}
    </div>
  );
}
