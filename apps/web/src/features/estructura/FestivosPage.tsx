import { useMemo, useState } from 'react';
import { Button, Card } from '@nucleo/ui';
import { Modal } from '../_shared/Modal';
import { formatDate } from '../../lib/format';
import { HolidayMarks, ambitoLabel } from '../absences/HolidayMarks';
import { useDeleteHoliday, useHolidaysManage, useUpdateHoliday } from '../absences/useAbsences';
import { FilaAcciones } from '../_shared/AccionesMenu';
import type { Holiday } from '../absences/useAbsences';

const selectClass =
  'h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none';

/**
 * Festivos de todos los ámbitos para ADMIN/RRHH: se ven con su ámbito (país o localización) y su estado
 * de revisión, y se marcan como validados. Los de fecha aproximada (lunares) se confirman fijando la
 * fecha real, lo que los deja validados.
 */
export function FestivosPage() {
  const { data: festivos, isLoading, error } = useHolidaysManage();
  const update = useUpdateHoliday();
  const remove = useDeleteHoliday();
  const [ambito, setAmbito] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [confirming, setConfirming] = useState<Holiday | null>(null);
  const [fecha, setFecha] = useState('');
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const ambitos = useMemo(() => {
    const set = new Map<string, string>();
    (festivos ?? []).forEach((h) => {
      const a = ambitoLabel(h);
      set.set(`${a.tipo}:${a.nombre}`, `${a.nombre} (${a.tipo.toLowerCase()})`);
    });
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [festivos]);

  const visibles = (festivos ?? []).filter((h) => {
    const a = ambitoLabel(h);
    return (!ambito || `${a.tipo}:${a.nombre}` === ambito) && (!soloPendientes || !h.validado);
  });
  const pendientes = (festivos ?? []).filter((h) => !h.validado).length;

  const fail = (e: unknown) => setMessage({ type: 'error', text: (e as Error).message });
  const validar = (h: Holiday) => {
    setMessage(null);
    update.mutate({ id: h.id, validado: true }, { onSuccess: () => setMessage({ type: 'ok', text: `«${h.name}» validado.` }), onError: fail });
  };
  const marcarPendiente = (h: Holiday) => {
    setMessage(null);
    update.mutate({ id: h.id, validado: false }, { onSuccess: () => setMessage({ type: 'ok', text: `«${h.name}» vuelve a pendiente de validación.` }), onError: fail });
  };
  const confirmarFecha = () => {
    if (!confirming || !fecha) return;
    setMessage(null);
    update.mutate(
      { id: confirming.id, date: fecha, aproximado: false, validado: true },
      {
        onSuccess: () => {
          setMessage({ type: 'ok', text: `Fecha de «${confirming.name}» confirmada y festivo validado.` });
          setConfirming(null);
        },
        onError: fail,
      },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-[13px] text-[var(--ink-tertiary)]">
          {festivos ? `${festivos.length} festivos · ${pendientes} pendientes de validación` : 'Cargando…'}
        </p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[12px] text-[var(--ink-secondary)]">
            <input type="checkbox" checked={soloPendientes} onChange={(e) => setSoloPendientes(e.target.checked)} />
            Solo pendientes
          </label>
          <select aria-label="Filtrar por ámbito" className={selectClass} value={ambito} onChange={(e) => setAmbito(e.target.value)}>
            <option value="">Todos los ámbitos</option>
            {ambitos.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-[12px] text-[var(--ink-secondary)] mb-3">
        Leyenda: <span aria-hidden="true">○</span> pendiente de validación · <span aria-hidden="true">●</span> validado ·{' '}
        <span aria-hidden="true">◇</span> fecha aproximada (se confirma con la fecha real).
      </p>

      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`text-[12px] mb-3 ${message.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--ink-secondary)]'}`}>
          {message.text}
        </p>
      )}
      {error && (
        <Card>
          <p role="alert" className="text-[var(--danger)] text-[13px]">No se pudo cargar: {(error as Error).message}</p>
        </Card>
      )}
      {isLoading && (
        <Card>
          <p className="text-[var(--ink-tertiary)] text-[13px]">Cargando festivos…</p>
        </Card>
      )}

      {festivos && (
        <Card padding="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-subtle)] border-b border-[var(--line)]">
                {['Fecha', 'Festivo', 'Ámbito', 'Estado', 'Fuente', 'Acciones'].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-medium text-[var(--ink-tertiary)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((h) => {
                const a = ambitoLabel(h);
                return (
                  <tr key={h.id} className="border-b border-[var(--line-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] align-top">
                    <td className="px-5 py-3 mono whitespace-nowrap">{formatDate(h.date)}</td>
                    <td className="px-5 py-3 font-medium">{h.name}</td>
                    <td className="px-5 py-3 text-[var(--ink-secondary)]">
                      {a.nombre} <span className="text-[11px] text-[var(--ink-tertiary)]">· {a.tipo}</span>
                    </td>
                    <td className="px-5 py-3">
                      <HolidayMarks holiday={h} />
                    </td>
                    <td className="px-5 py-3 text-[12px] text-[var(--ink-tertiary)] max-w-[220px] truncate" title={h.fuente ?? undefined}>
                      {h.fuente ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <FilaAcciones
                        label={`Acciones del festivo ${h.name}`}
                        extra={[
                          ...(h.aproximado
                            ? [{ key: 'confirmar', label: 'Confirmar fecha', onSelect: () => { setFecha(h.date.slice(0, 10)); setConfirming(h); } }]
                            : !h.validado
                              ? [{ key: 'validar', label: 'Marcar validado', onSelect: () => validar(h) }]
                              : [{ key: 'pendiente', label: 'Marcar como pendiente', onSelect: () => marcarPendiente(h) }]),
                        ]}
                        eliminar={{
                          title: 'Eliminar festivo',
                          message: `¿Eliminar el festivo «${h.name}» (${formatDate(h.date)}, ${a.nombre})? Queda registrado en la auditoría. Esta acción no se puede deshacer.`,
                          disabledReason: h.validado ? 'Un festivo validado no se elimina: márcalo antes como pendiente.' : undefined,
                          onConfirm: () => remove.mutateAsync(h.id),
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[13px] text-[var(--ink-tertiary)]">
                    No hay festivos con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {confirming && (
        <Modal
          title="Confirmar fecha"
          subtitle={confirming.name}
          onClose={() => setConfirming(null)}
          footer={
            <>
              <Button variant="ghost" type="button" onClick={() => setConfirming(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="button" disabled={!fecha || update.isPending} onClick={confirmarFecha}>
                {update.isPending ? 'Guardando…' : 'Confirmar y validar'}
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-[var(--ink-secondary)] mb-3">
            Esta fecha es aproximada ({ambitoLabel(confirming).nombre}). Indica la fecha real confirmada; el festivo quedará validado y dejará de
            ser aproximado.
          </p>
          <label htmlFor="festivo-fecha" className="block text-[12px] font-medium text-[var(--ink-secondary)] mb-1.5">
            Fecha confirmada
          </label>
          <input id="festivo-fecha" type="date" className={selectClass} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Modal>
      )}
    </div>
  );
}
