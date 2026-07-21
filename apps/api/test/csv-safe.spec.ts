import { describe, expect, it } from 'vitest';
import { csvSafe } from '../src/lib/csv-safe';

describe('csvSafe (auditoría M3 — CSV/formula injection)', () => {
  it('deja intacto un texto normal', () => {
    expect(csvSafe('Diego Ortega Marín')).toBe('Diego Ortega Marín');
  });

  it('neutraliza un valor que empieza por =', () => {
    expect(csvSafe('=HYPERLINK("http://evil.example")')).toBe("'=HYPERLINK(\"http://evil.example\")");
  });

  it('neutraliza +, -, @ y tab al inicio', () => {
    expect(csvSafe('+1234')).toMatch(/^'\+/);
    expect(csvSafe('-1234')).toMatch(/^'-/);
    expect(csvSafe('@SUM(A1)')).toMatch(/^'@/);
    expect(csvSafe('\tmalicioso')).toMatch(/^'\t/);
  });

  it('quita saltos de línea y el separador de campo', () => {
    expect(csvSafe('línea1\nlínea2;otro')).toBe('línea1 línea2 otro');
  });

  it('no marca como fórmula un = que no está al principio', () => {
    expect(csvSafe('IBAN=ES12')).toBe('IBAN=ES12');
  });
});
