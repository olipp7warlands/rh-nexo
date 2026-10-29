import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine, icsDate, icsLocalDateTime } from '../src/lib/ics';

describe('ICS · escapeText', () => {
  it('escapa barra invertida, punto y coma, coma y saltos de línea', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf');
  });

  it('descarta caracteres de control pero conserva acentos y emojis', () => {
    expect(escapeText('Año\u0000 Nuevo\u0007 🎉')).toBe('Año Nuevo 🎉');
  });

  it('un valor malicioso no puede inyectar propiedades (los saltos quedan escapados)', () => {
    const evil = 'x\r\nATTENDEE:mailto:atacante@example.com\r\nEND:VEVENT';
    const out = buildCalendar({
      name: 'cal',
      stamp: new Date('2026-01-01T00:00:00Z'),
      events: [{ uid: 'a@b', summary: evil, startDate: new Date('2026-05-01T00:00:00Z') }],
    });
    expect(out).not.toMatch(/^ATTENDEE:/m);
    expect(out.match(/^END:VEVENT/gm)).toHaveLength(1);
  });
});

describe('ICS · foldLine', () => {
  const octets = (s: string) => Buffer.byteLength(s, 'utf8');

  it('no toca una línea corta', () => {
    expect(foldLine('SUMMARY:corto')).toBe('SUMMARY:corto');
  });

  it('pliega a 75 octetos como máximo por línea física, con continuación que empieza por espacio', () => {
    const folded = foldLine('DESCRIPTION:' + 'a'.repeat(300));
    const phys = folded.split('\r\n');
    expect(phys.length).toBeGreaterThan(1);
    for (const l of phys) expect(octets(l)).toBeLessThanOrEqual(75);
    for (const l of phys.slice(1)) expect(l.startsWith(' ')).toBe(true);
    // Al desplegar se recupera exactamente la línea original.
    expect(phys.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe('DESCRIPTION:' + 'a'.repeat(300));
  });

  it('nunca parte un carácter multibyte (acentos y emojis) y se recompone sin pérdida', () => {
    const original = 'SUMMARY:' + 'ñé🎉ü'.repeat(40);
    const phys = foldLine(original).split('\r\n');
    for (const l of phys) {
      expect(octets(l)).toBeLessThanOrEqual(75);
      expect(l).not.toContain('�');
    }
    expect(phys.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(original);
  });
});

describe('ICS · fechas', () => {
  it('icsDate usa la fecha UTC', () => {
    expect(icsDate(new Date('2026-03-05T00:00:00Z'))).toBe('20260305');
  });

  it('icsLocalDateTime convierte a hora de pared de Madrid (CET en invierno, CEST en verano)', () => {
    expect(icsLocalDateTime(new Date('2026-01-15T09:30:00Z'))).toBe('20260115T103000'); // UTC+1
    expect(icsLocalDateTime(new Date('2026-07-15T09:30:00Z'))).toBe('20260715T113000'); // UTC+2
  });
});

describe('ICS · buildCalendar', () => {
  const stamp = new Date('2026-10-29T12:00:00Z');
  const cal = buildCalendar({
    name: 'humanX, equipo',
    stamp,
    refreshHours: 12,
    events: [
      { uid: 'abs-1@humanx', summary: 'Vacaciones — Ana', startDate: new Date('2026-08-03T00:00:00Z'), endDate: new Date('2026-08-07T00:00:00Z') },
      { uid: 'int-1@humanx', summary: 'Entrevista — Backend', description: 'Entrevista técnica', start: new Date('2026-11-05T09:30:00Z'), durationMinutes: 45 },
    ],
  });

  it('usa CRLF en todas las líneas, termina en CRLF y envuelve en VCALENDAR', () => {
    expect(cal.endsWith('\r\n')).toBe(true);
    expect(cal.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(cal.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(cal.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('evento de día completo: DTEND exclusivo (último día + 1) y escapa el nombre del calendario', () => {
    expect(cal).toContain('X-WR-CALNAME:humanX\\, equipo');
    expect(cal).toContain('DTSTART;VALUE=DATE:20260803');
    expect(cal).toContain('DTEND;VALUE=DATE:20260808');
  });

  it('evento con hora: Europe/Madrid, duración indicada y VTIMEZONE presente', () => {
    expect(cal).toContain('DTSTART;TZID=Europe/Madrid:20261105T103000');
    expect(cal).toContain('DTEND;TZID=Europe/Madrid:20261105T111500');
    expect(cal).toContain('BEGIN:VTIMEZONE\r\nTZID:Europe/Madrid');
  });

  it('DTSTAMP fijo (contenido estable ⇒ ETag útil) y misma salida en dos llamadas', () => {
    expect(cal.match(/DTSTAMP:20261029T120000Z/g)).toHaveLength(2);
    const again = buildCalendar({ name: 'humanX, equipo', stamp, refreshHours: 12, events: [] });
    expect(again).toBe(buildCalendar({ name: 'humanX, equipo', stamp, refreshHours: 12, events: [] }));
  });

  it('ninguna línea física supera 75 octetos', () => {
    const long = buildCalendar({
      name: 'x',
      stamp,
      events: [{ uid: 'l@x', summary: 'Ausencia — ' + 'Nombre muy largo '.repeat(20), startDate: new Date('2026-01-01T00:00:00Z') }],
    });
    for (const l of long.split('\r\n')) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
  });
});
