/** Antigüedad legible a partir de la fecha de alta (ISO). Hoy se calcula en runtime. */
export function seniority(startDate: string): string {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return '—';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 1) return 'Recién incorporado';
  if (months < 12) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const y = `${years} ${years === 1 ? 'año' : 'años'}`;
  return rem === 0 ? y : `${y} y ${rem} ${rem === 1 ? 'mes' : 'meses'}`;
}

/** Fecha ISO → dd/mm/aaaa. */
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Importe en euros (entero) → "58.000 €". */
export function formatEuro(amount?: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return `${amount.toLocaleString('es-ES')} €`;
}

/** Días laborables (lun–vie) entre dos ISO inclusive. Preview cliente; el servidor también descuenta festivos. */
export function businessDays(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

export const LEVEL_LABEL: Record<string, string> = {
  exec: 'Dirección',
  lead: 'Lead / Manager',
  senior: 'Senior',
  mid: 'Intermedio',
  junior: 'Junior',
};

export const CONTRACT_LABEL: Record<string, string> = {
  INDEFINIDO: 'Indefinido',
  TEMPORAL: 'Temporal',
  PRACTICAS: 'Prácticas',
  FREELANCE: 'Freelance',
};
