/**
 * Deja un valor de usuario listo para ir en un campo de nuestros CSV (separador `;`), de modo
 * que la hoja de cálculo lo muestre SIEMPRE como texto literal. Dos defensas, las dos necesarias:
 *
 * 1. Fórmulas (auditoría M3): un valor que empiece por `=`, `+`, `-`, `@` o tab se interpreta
 *    como fórmula al abrir el CSV en Excel/LibreOffice. Se le antepone un apóstrofo. El carácter
 *    se busca tras los espacios y comillas iniciales, no solo en la posición 0: la hoja de cálculo
 *    puede descartarlos antes de decidir si la celda es una fórmula.
 * 2. Entrecomillado RFC 4180: un campo que empieza por `"` lo lee el parser como campo
 *    entrecomillado y le QUITA las comillas, así que el contenido puede acabar siendo una fórmula
 *    aunque el texto original no empezara por `=`. Todo valor con comillas, o con espacios en los
 *    extremos, se emite entrecomillado y con sus comillas dobladas: el parser devuelve entonces el
 *    texto original, carácter a carácter.
 *
 * Además sustituye por un espacio los saltos de línea, el separador de campo y el resto de
 * caracteres de control, para no romper la fila.
 */
export function csvSafe(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const flat = raw.replace(/[\u0000-\u0008\u000A-\u001F\u007F;]/g, ' ');
  const neutralized = /^[\s"]*[=+\-@\t]/.test(flat) ? `'${flat}` : flat;
  const needsQuoting = neutralized.includes('"') || neutralized !== neutralized.trim();
  return needsQuoting ? `"${neutralized.replace(/"/g, '""')}"` : neutralized;
}
