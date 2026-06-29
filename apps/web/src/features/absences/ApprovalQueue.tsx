import { useState } from 'react';
import { Avatar, Button, Card } from '@nucleo/ui';
import { useAbsences, useDecideAbsence } from './useAbsences';
import { AbsenceTypeBadge } from './AbsenceBadges';
import { formatDate } from '../../lib/format';

/** Cola de solicitudes pendientes con aprobar/rechazar. Usada en Ausencias e Inicio. */
export function ApprovalQueue({ compact = false }: { compact?: boolean }) {
  const { data: pending, isLoading } = useAbsences('PENDIENTE');
  const decide = useDecideAbsence();
  const [error, setError] = useState<string | null>(null);

  const act = (id: string, action: 'approve' | 'reject') => {
    setError(null);
    decide.mutate({ id, action }, { onError: (e) => setError((e as Error).message) });
  };

  return (
    <Card padding="p-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
        <h3 className="text-[14px] font-semibold">Solicitudes pendientes</h3>
        {pending && pending.length > 0 && (
          <span className="mono text-[12px] text-[var(--ink-tertiary)]">{pending.length}</span>
        )}
      </div>

      {isLoading && <p className="px-5 py-6 text-[13px] text-[var(--ink-tertiary)]">Cargando…</p>}
      {pending && pending.length === 0 && (
        <p className="px-5 py-8 text-center text-[13px] text-[var(--ink-tertiary)]">No hay solicitudes pendientes. 🎉</p>
      )}
      {error && <p className="px-5 pt-3 text-[12px] text-[var(--danger)]">{error}</p>}

      <div className="divide-y divide-[var(--line-subtle)]">
        {pending?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={a.employee?.fullName ?? '—'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium flex items-center gap-2">
                {a.employee?.fullName}
                <AbsenceTypeBadge type={a.type} />
              </div>
              <div className="text-[12px] text-[var(--ink-tertiary)]">
                {formatDate(a.startDate)} – {formatDate(a.endDate)} · {a.days} {a.days === 1 ? 'día' : 'días'}
                {!compact && a.reason ? ` · ${a.reason}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={decide.isPending} onClick={() => act(a.id, 'reject')}>
                Rechazar
              </Button>
              <Button size="sm" variant="primary" disabled={decide.isPending} onClick={() => act(a.id, 'approve')}>
                Aprobar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
