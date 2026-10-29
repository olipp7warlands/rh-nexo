import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { holidayScopeWhere, resolveHolidayScope } from '../lib/holiday-scope';
import { UpdateHolidayDto } from './holidays.dto';

const WITH_SCOPE = {
  pais: { select: { id: true, nombre: true } },
  localizacion: { select: { id: true, nombre: true, pais: { select: { id: true, nombre: true } } } },
} satisfies Prisma.HolidayInclude;

@Injectable()
export class HolidaysService {
  constructor(private readonly db: PrismaService) {}

  /**
   * Festivos que aplican al usuario: los de su país y los de su localización (ver resolveHolidayScope).
   * Un usuario sin ficha (cuentas ADMIN/RRHH de gestión) ve todos, con su ámbito; el resto, ninguno.
   */
  async findForViewer(viewer: AuthUser) {
    let where: Prisma.HolidayWhereInput;
    if (viewer.employeeId) where = holidayScopeWhere(await resolveHolidayScope(this.db, viewer.employeeId));
    else where = viewer.role === 'ADMIN' || viewer.role === 'RRHH' ? {} : { id: { in: [] } };
    return this.db.holiday.findMany({ where, include: WITH_SCOPE, orderBy: { date: 'asc' } });
  }

  /** Todos los festivos con su ámbito y estado de revisión (gestión ADMIN/RRHH). */
  findAllForManagement() {
    return this.db.holiday.findMany({ include: WITH_SCOPE, orderBy: [{ date: 'asc' }, { name: 'asc' }] });
  }

  /**
   * Elimina un festivo PENDIENTE (p. ej. cargado por error). Un festivo validado está confirmado por
   * RRHH y no se elimina: hay que marcarlo como pendiente antes (dos pasos conscientes). Auditado.
   */
  async remove(id: string, viewer: AuthUser) {
    const before = await this.db.holiday.findUnique({ where: { id }, include: WITH_SCOPE });
    if (!before) throw new NotFoundException('Festivo no encontrado');
    if (before.validado) {
      throw new ConflictException('Un festivo validado no se elimina: márcalo primero como pendiente.');
    }
    await this.db.$transaction([
      this.db.holiday.delete({ where: { id } }),
      this.db.auditLog.create({
        data: {
          actorId: viewer.id,
          action: 'DELETE',
          entity: 'Holiday',
          entityId: id,
          before: {
            date: before.date.toISOString().slice(0, 10),
            name: before.name,
            ambito: before.localizacion?.nombre ?? before.pais?.nombre ?? null,
            validado: before.validado,
            aproximado: before.aproximado,
            fuente: before.fuente,
          },
        },
      }),
    ]);
    return { id, deleted: true };
  }

  /** Marca un festivo como validado y/o confirma su fecha. Auditado con antes/después. */
  async update(id: string, dto: UpdateHolidayDto, viewer: AuthUser) {
    const before = await this.db.holiday.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Festivo no encontrado');
    if (dto.validado === undefined && dto.aproximado === undefined && dto.date === undefined) {
      throw new BadRequestException('No hay nada que actualizar.');
    }
    const data: Prisma.HolidayUpdateInput = {};
    if (dto.validado !== undefined) data.validado = dto.validado;
    if (dto.aproximado !== undefined) data.aproximado = dto.aproximado;
    if (dto.date !== undefined) data.date = new Date(dto.date);

    let after;
    try {
      after = await this.db.holiday.update({ where: { id }, data, include: WITH_SCOPE });
    } catch (e) {
      // Índices únicos parciales (ámbito + fecha + nombre): mover la fecha puede chocar con otro festivo igual.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un festivo con ese nombre y fecha en el mismo ámbito.');
      }
      throw e;
    }
    const pick = (h: { date: Date; validado: boolean; aproximado: boolean }) => ({
      date: h.date.toISOString().slice(0, 10),
      validado: h.validado,
      aproximado: h.aproximado,
    });
    await this.db.auditLog.create({
      data: { actorId: viewer.id, action: 'UPDATE', entity: 'Holiday', entityId: id, before: pick(before), after: pick(after) },
    });
    return after;
  }
}
