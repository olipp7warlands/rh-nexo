/**
 * Auditoría M3 (CSV/formula injection): un valor de usuario que empiece por `=`, `+`, `-`,
 * `@`, tab o retorno de carro se interpreta como fórmula al abrir el CSV en Excel/LibreOffice
 * (p. ej. `=HYPERLINK(...)` puede filtrar datos o ejecutar comandos). Antepone un apóstrofo
 * para neutralizarlo — Excel lo muestra como texto literal. También normaliza saltos de línea
 * y el separador de campo (`;`) para no romper la fila.
 */
export function csvSafe(raw: string): string {
  const withoutSeparators = raw.replace(/[\n\r;]/g, ' ');
  return /^[=+\-@\t]/.test(withoutSeparators) ? `'${withoutSeparators}` : withoutSeparators;
}
