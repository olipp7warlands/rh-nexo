import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useCalendar, useHolidays } from './useAbsences';
import { useAlertas, TIPO_ALERTA_LABEL, type Alerta } from '../agenda/useAgenda';
import { useAnotaciones, type Anotacion } from '../anotaciones/useAnotaciones';
import { formatDate } from '../../lib/format';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function CalendarioPage() {
  const { user } = useAuth();
  const canSeeAnotaciones = user?.role === 'ADMIN' || user?.role === 'RRHH';

  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getUTCFullYear(), m: today.getUTCMonth() });

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const last = new Date(Date.UTC(cursor.y, cursor.m + 1, 0));
  const { data: absences } = useCalendar(iso(first), iso(last));
  const { data: holidays } = useHolidays();
  const { data: alertas } = useAlertas();
  const { data: anotaciones } = useAnotaciones({ estado: 'PENDIENTE' }, canSeeAnotaciones);

  // Mapa día(ISO) → festivo y → ausencias que lo cubren.
  const holidayByDay = useMemo(() => {
    const map = new Map<string, string>();
    (holidays ?? []).forEach((h) => map.set(h.date.slice(0, 10), h.name));
    return map;
  }, [holidays]);

  const alertasByDay = useMemo(() => {
    const map = new Map<string, Alerta[]>();
    (alertas ?? []).forEach((a) => {
      const day = a.fecha.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), a]);
    });
    return map;
  }, [alertas]);

  const anotacionesByDay = useMemo(() => {
    const map = new Map<string, Anotacion[]>();
    (anotaciones ?? []).forEach((a) => {
      const day = a.fecha.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), a]);
    });
    return map;
  }, [anotaciones]);

  const cells = useMemo(() => {
    const lead = (first.getUTCDay() + 6) % 7; // lunes primero
    const days = last.getUTCDate();
    const arr: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push({ day: d, date: iso(new Date(Date.UTC(cursor.y, cursor.m, d))) });
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor, first, last]);

  const absOnDay = (dayISO: string) =>
    (absences ?? []).filter((a) => a.startDate.slice(0, 10) <= dayISO && a.endDate.slice(0, 10) >= dayISO);

  const move = (delta: number) => {
    const m = cursor.m + delta;
    setCursor({ y: cursor.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  // Feed "Hoy": alertas de contrato + anotaciones pendientes, en orden cronológico.
  const feed = useMemo(() => {
    const items: { key: string; fecha: string; kind: 'alerta' | 'anotacion'; render: () => JSX.Element }[] = [];
    (alertas ?? []).forEach((a) =>
      items.push({
        key: a.id,
        fecha: a.fecha,
        kind: 'alerta',
        render: () => (
          <div className="flex items-center gap-3 py-2.5 border-b border-[var(--line-subtle)] last:border-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${a.diasRestantes < 0 ? 'bg-[var(--ink-primary)]' : 'bg-transparent border-[1.5px] border-[var(--ink-primary)]'}`} />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-medium">{a.empleado.fullName}</span>
              <span className="text-[12px] text-[var(--ink-secondary)]"> · {TIPO_ALERTA_LABEL[a.tipo]}</span>
            </div>
            <span className="mono text-[11px] text-[var(--ink-tertiary)] shrink-0">
              {a.diasRestantes === 0 ? 'Hoy' : a.diasRestantes > 0 ? `en ${a.diasRestantes} días` : `hace ${-a.diasRestantes} días`}
            </span>
          </div>
        ),
      }),
    );
    (anotaciones ?? []).forEach((a) =>
      items.push({
        key: a.id,
        fecha: a.fecha,
        kind: 'anotacion',
        render: () => (
          <div className="flex items-center gap-3 py-2.5 border-b border-[var(--line-subtle)] last:border-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.categoria?.color ?? 'var(--ink-tertiary)' }} />
            <div className="min-w-0 flex-1">
              <span className="text-[13px] font-medium">{a.empleado.fullName}</span>
              <span className="text-[12px] text-[var(--ink-secondary)] truncate"> · {a.texto}</span>
            </div>
            <span className="mono text-[11px] text-[var(--ink-tertiary)] shrink-0">{formatDate(a.fecha)}</span>
          </div>
        ),
      }),
    );
    return items.sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 8);
  }, [alertas, anotaciones]);

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow="Principal" title="Agenda" subtitle="Hoy y el mes por delante." />

      <Card padding="p-0" className="mb-6">
        <div className="px-5 py-4 border-b border-[var(--line)]">
          <h3 className="font-serif text-[14px] font-medium">Hoy</h3>
        </div>
        <div className="px-5">
          {feed.length > 0 ? (
            feed.map((i) => <div key={i.key}>{i.render()}</div>)
          ) : (
            <p className="text-[13px] text-[var(--ink-tertiary)] py-4">Nada pendiente en el horizonte cercano.</p>
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif text-[14px] font-medium">Calendario</h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => move(-1)} aria-label="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-serif text-[14px] font-medium min-w-[140px] text-center">
            {MONTHS[cursor.m]} {cursor.y}
          </span>
          <Button variant="secondary" size="sm" onClick={() => move(1)} aria-label="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card padding="p-0">
        <div className="grid grid-cols-7 border-b border-[var(--line)]">
          {DOW.map((d, i) => (
            <div
              key={d}
              className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-[var(--ink-tertiary)] ${i >= 5 ? 'bg-[var(--bg-subtle)]' : ''}`}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((c, i) => {
            const weekend = i % 7 >= 5;
            const holiday = c && holidayByDay.get(c.date);
            const dayAbs = c ? absOnDay(c.date) : [];
            const dayAlertas = c ? alertasByDay.get(c.date) ?? [] : [];
            const dayAnotaciones = c ? anotacionesByDay.get(c.date) ?? [] : [];
            const categoriaColores = [...new Set(dayAnotaciones.map((a) => a.categoria?.color ?? 'var(--ink-tertiary)'))];
            return (
              <div
                key={i}
                className={`min-h-[104px] border-b border-r border-[var(--line-subtle)] p-2 ${weekend ? 'bg-[var(--bg-subtle)]' : ''} ${!c ? 'bg-[var(--bg-subtle)]/40' : ''}`}
              >
                {c && (
                  <>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[12px] font-medium text-[var(--ink-secondary)]">{c.day}</span>
                      <div className="flex items-center gap-1">
                        {dayAlertas.length > 0 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[var(--ink-primary)]"
                            title={dayAlertas.map((a) => `${a.empleado.fullName} · ${TIPO_ALERTA_LABEL[a.tipo]}`).join(', ')}
                          />
                        )}
                        {holiday && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--warning-soft)] text-[var(--warning)]" title={holiday}>
                            festivo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      {dayAbs.slice(0, 2).map((a) => (
                        <div
                          key={a.id}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                          title={a.employee?.fullName}
                        >
                          {a.employee?.fullName}
                        </div>
                      ))}
                      {dayAbs.length > 2 && <span className="text-[10px] text-[var(--ink-tertiary)]">+{dayAbs.length - 2} más</span>}
                    </div>
                    {categoriaColores.length > 0 && (
                      <div className="mt-1.5 flex items-center gap-1" title={dayAnotaciones.map((a) => a.empleado.fullName).join(', ')}>
                        {categoriaColores.slice(0, 5).map((color, idx) => (
                          <span key={idx} className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
