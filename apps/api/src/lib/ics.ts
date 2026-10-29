/**
 * Generador mínimo de iCalendar (RFC 5545) sin dependencias. Solo lo que necesita el feed de
 * humanX: eventos de día completo y eventos con hora en Europe/Madrid. Todo el texto de usuario
 * se escapa, las líneas se pliegan a 75 octetos (sin partir caracteres UTF-8) y se separan con CRLF.
 */

export const ICS_TZ = 'Europe/Madrid';

/** Escapa un valor TEXT: `\`, `;`, `,` y saltos de línea; descarta caracteres de control. */
export function escapeText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Pliega una línea lógica a 75 octetos UTF-8 como máximo; las continuaciones empiezan por un espacio. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = Buffer.byteLength(ch, 'utf8');
    if (bytes + n > limit) {
      out.push(current);
      current = ' '; // el espacio inicial de continuación cuenta como 1 octeto
      bytes = 1;
      limit = 75;
    }
    current += ch;
    bytes += n;
  }
  out.push(current);
  return out.join('\r\n');
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `YYYYMMDD` con la fecha UTC de un Date (las fechas de BD son medianoche UTC). */
export function icsDate(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** `YYYYMMDDTHHMMSSZ` en UTC. */
export function icsUtcDateTime(d: Date): string {
  return `${icsDate(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Hora local de pared en Europe/Madrid (`YYYYMMDDTHHMMSS`, sin zona) de un instante. */
export function icsLocalDateTime(d: Date, timeZone = ICS_TZ): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}${get('month')}${get('day')}T${get('hour')}${get('minute')}${get('second')}`;
}

export interface IcsAllDayEvent {
  uid: string;
  summary: string;
  description?: string;
  /** Primer día (inclusive), medianoche UTC. */
  startDate: Date;
  /** Último día (inclusive); por defecto, el mismo. */
  endDate?: Date;
}

export interface IcsTimedEvent {
  uid: string;
  summary: string;
  description?: string;
  start: Date;
  durationMinutes?: number;
}

export type IcsEvent = IcsAllDayEvent | IcsTimedEvent;

const isTimed = (e: IcsEvent): e is IcsTimedEvent => 'start' in e;

const VTIMEZONE_MADRID = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Madrid',
  'X-LIC-LOCATION:Europe/Madrid',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/**
 * Construye un VCALENDAR completo. `stamp` fija el DTSTAMP de todos los eventos (así el contenido es
 * estable entre peticiones y el ETag sirve). Devuelve el texto con CRLF y salto final.
 */
export function buildCalendar(opts: { name: string; events: IcsEvent[]; stamp: Date; refreshHours?: number }): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//humanX//Feed de calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-TIMEZONE:${ICS_TZ}`,
  ];
  if (opts.refreshHours) {
    lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${opts.refreshHours}H`, `X-PUBLISHED-TTL:PT${opts.refreshHours}H`);
  }
  lines.push(...VTIMEZONE_MADRID);

  const dtstamp = icsUtcDateTime(opts.stamp);
  for (const e of opts.events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`);
    if (isTimed(e)) {
      const end = new Date(e.start.getTime() + (e.durationMinutes ?? 60) * 60_000);
      lines.push(`DTSTART;TZID=${ICS_TZ}:${icsLocalDateTime(e.start)}`, `DTEND;TZID=${ICS_TZ}:${icsLocalDateTime(end)}`);
    } else {
      const last = e.endDate ?? e.startDate;
      const exclusiveEnd = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1));
      lines.push(`DTSTART;VALUE=DATE:${icsDate(e.startDate)}`, `DTEND;VALUE=DATE:${icsDate(exclusiveEnd)}`, 'TRANSP:TRANSPARENT');
    }
    lines.push(`SUMMARY:${escapeText(e.summary)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
