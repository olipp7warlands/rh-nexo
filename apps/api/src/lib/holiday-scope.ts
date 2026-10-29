import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Ámbito de festivos de una persona: su localización concreta y el país del que depende. */
export interface HolidayScope {
  localizacionId: string | null;
  paisId: string | null;
}

/**
 * Ámbito de festivos de un empleado. País = el de su localización; si esta no tiene país asignado
 * (localizaciones creadas antes del campo) se usa el de su sociedad; si tampoco hay, solo cuentan
 * los festivos de su localización concreta (nunca se asume un país). Un empleado inexistente no
 * tiene ámbito: no se le descuenta ningún festivo.
 */
export async function resolveHolidayScope(db: PrismaService, employeeId: string): Promise<HolidayScope> {
  const e = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      localizacionId: true,
      localizacion: { select: { paisId: true } },
      sociedad: { select: { paisId: true } },
    },
  });
  return {
    localizacionId: e?.localizacionId ?? null,
    paisId: e?.localizacion?.paisId ?? e?.sociedad?.paisId ?? null,
  };
}

/**
 * Filtro Prisma de los festivos que aplican a un ámbito: los de su país (sin localización) más los
 * de su localización. Sin ningún ámbito no casa nada (nunca «todos»).
 */
export function holidayScopeWhere(scope: HolidayScope): Prisma.HolidayWhereInput {
  const or: Prisma.HolidayWhereInput[] = [];
  if (scope.paisId) or.push({ paisId: scope.paisId, localizacionId: null });
  if (scope.localizacionId) or.push({ localizacionId: scope.localizacionId });
  return or.length > 0 ? { OR: or } : { id: { in: [] } };
}
