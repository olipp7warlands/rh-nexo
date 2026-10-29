import { ConflictException } from '@nestjs/common';

export interface Referencia {
  n: number;
  singular: string;
  plural: string;
}

/**
 * Protección de borrado de catálogos: si algo sigue referenciando el elemento lanza 409 con el
 * motivo completo («está en uso por 2 personas y 1 oferta»). Nada se borra «en cascada» ni se
 * desvincula en silencio: primero hay que resolver las referencias.
 */
export function assertSinReferencias(sujeto: string, referencias: Referencia[]): void {
  const con = referencias.filter((r) => r.n > 0).map((r) => `${r.n} ${r.n === 1 ? r.singular : r.plural}`);
  if (con.length === 0) return;
  const lista = con.length === 1 ? con[0]! : `${con.slice(0, -1).join(', ')} y ${con[con.length - 1]}`;
  throw new ConflictException(`No se puede eliminar ${sujeto}: está en uso por ${lista}.`);
}
