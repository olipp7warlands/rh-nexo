import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Card, PageHeader } from '@nucleo/ui';
import { useCalendar, useHolidays } from './useAbsences';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function CalendarioPage() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getUTCFullYear(), m: today.getUTCMonth() });

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const last = new Date(Date.UTC(cursor.y, cursor.m + 1, 0));
  const { data: absences } = useCalendar(iso(first), iso(last));
  const { data: holidays } = useHolidays();

  // Mapa día(ISO) → festivo y → ausencias que lo cubren.
  const holidayByDay = useMemo(() => {
    const map = new Map<string, string>();
    (holidays ?? []).forEach((h) => map.set(h.date.slice(0, 10), h.name));
    return map;
  }, [holidays]);

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

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Tiempo"
        title="Calendario"
        subtitle="Ausencias aprobadas del equipo y festivos."
        actions={
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
        }
      />

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
            return (
              <div
                key={i}
                className={`min-h-[96px] border-b border-r border-[var(--line-subtle)] p-2 ${weekend ? 'bg-[var(--bg-subtle)]' : ''} ${!c ? 'bg-[var(--bg-subtle)]/40' : ''}`}
              >
                {c && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-[var(--ink-secondary)]">{c.day}</span>
                      {holiday && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--warning-soft)] text-[var(--warning)]" title={holiday}>
                          festivo
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-col gap-1">
                      {dayAbs.slice(0, 3).map((a) => (
                        <div
                          key={a.id}
                          className="text-[10px] truncate px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                          title={a.employee?.fullName}
                        >
                          {a.employee?.fullName}
                        </div>
                      ))}
                      {dayAbs.length > 3 && <span className="text-[10px] text-[var(--ink-tertiary)]">+{dayAbs.length - 3} más</span>}
                    </div>
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
