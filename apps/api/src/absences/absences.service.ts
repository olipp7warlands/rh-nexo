import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AbsenceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreateAbsenceDto } from './absence.dto';
import { csvSafe } from '../lib/csv-safe';

const iso = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class AbsencesService {
  constructor(private readonly db: PrismaService) {}

  /** Alcance por rol: EMPLEADO ve lo suyo; MANAGER su equipo + lo suyo; RRHH/ADMIN todo. */
  private scopeWhere(viewer: AuthUser): Prisma.AbsenceWhereInput {
    const own = viewer.employeeId ?? '__none__';
    if (viewer.role === 'ADMIN' || viewer.role === 'RRHH') return {};
    if (viewer.role === 'MANAGER') return { OR: [{ employeeId: own }, { employee: { managerId: own } }] };
    return { employeeId: own };
  }

  private readonly employeeSelect = {
    select: {
      id: true,
      fullName: true,
      jobTitle: true,
      location: true,
      managerId: true,
      department: { select: { name: true, color: true } },
    },
  };

  findAll(viewer: AuthUser, status?: AbsenceStatus) {
    return this.db.absence.findMany({
      where: { ...this.scopeWhere(viewer), status: status || undefined },
      include: { employee: this.employeeSelect },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Ausencias APROBADAS que solapan el rango (para el calendario de equipo). */
  calendar(viewer: AuthUser, from: string, to: string) {
    return this.db.absence.findMany({
      where: {
        ...this.scopeWhere(viewer),
        status: 'APROBADA',
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { startDate: 'asc' },
    });
  }

  /** Días laborables del rango (excluye fines de semana y festivos de la ubicación). */
  private async leaveDays(start: Date, end: Date, location: string | null): Promise<number> {
    const holidays = await this.db.holiday.findMany({
      where: {
        date: { gte: start, lte: end },
        OR: [{ location: null }, ...(location ? [{ location }] : [])],
      },
    });
    const hset = new Set(holidays.map((h) => iso(h.date)));
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6 && !hset.has(iso(d))) count++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return count;
  }

  async create(dto: CreateAbsenceDto, viewer: AuthUser) {
    if (!viewer.employeeId) throw new BadRequestException('Tu usuario no tiene ficha de empleado.');
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('La fecha de fin es anterior al inicio.');

    const employee = await this.db.employee.findUnique({ where: { id: viewer.employeeId } });
    const days = await this.leaveDays(start, end, employee?.location ?? null);
    if (days < 1) throw new BadRequestException('El rango no incluye días laborables.');

    const year = start.getUTCFullYear();
    if (dto.type === 'VACACIONES') {
      const bal = await this.db.leaveBalance.findUnique({
        where: { employeeId_year: { employeeId: viewer.employeeId, year } },
      });
      if (bal) {
        const available = bal.total - bal.used - bal.pending;
        if (days > available) {
          throw new BadRequestException(`Saldo insuficiente: ${available} días disponibles, solicitas ${days}.`);
        }
        await this.db.leaveBalance.update({ where: { id: bal.id }, data: { pending: bal.pending + days } });
      }
    }

    const absence = await this.db.absence.create({
      data: { employeeId: viewer.employeeId, type: dto.type, startDate: start, endDate: end, days, reason: dto.reason },
    });
    await this.audit(viewer.id, 'CREATE', absence.id, null, absence);
    return absence;
  }

  async decide(id: string, viewer: AuthUser, approve: boolean) {
    const absence = await this.db.absence.findUnique({ where: { id }, include: { employee: true } });
    if (!absence) throw new NotFoundException('Ausencia no encontrada');
    if (absence.status !== 'PENDIENTE') throw new BadRequestException('La solicitud ya fue resuelta.');
    if (viewer.role === 'MANAGER' && absence.employee.managerId !== viewer.employeeId) {
      throw new ForbiddenException('Solo puedes resolver ausencias de tu equipo.');
    }

    const year = absence.startDate.getUTCFullYear();
    if (absence.type === 'VACACIONES') {
      const bal = await this.db.leaveBalance.findUnique({
        where: { employeeId_year: { employeeId: absence.employeeId, year } },
      });
      if (bal) {
        const pending = Math.max(0, bal.pending - absence.days);
        await this.db.leaveBalance.update({
          where: { id: bal.id },
          data: approve ? { pending, used: bal.used + absence.days } : { pending },
        });
      }
    }

    const { employee, ...before } = absence;
    const updated = await this.db.absence.update({
      where: { id },
      data: {
        status: approve ? 'APROBADA' : 'RECHAZADA',
        approverId: viewer.employeeId ?? undefined,
        decidedAt: new Date(),
      },
    });
    await this.audit(viewer.id, approve ? 'APPROVE' : 'REJECT', id, before, updated);
    await this.notify(absence.employeeId, updated.id, updated.status);
    return updated;
  }

  async exportCsv(viewer: AuthUser, status?: AbsenceStatus): Promise<string> {
    const rows = await this.findAll(viewer, status);
    const header = ['Empleado', 'Tipo', 'Inicio', 'Fin', 'Días', 'Estado', 'Motivo'];
    const lines = rows.map((r) =>
      [csvSafe(r.employee.fullName), r.type, iso(r.startDate), iso(r.endDate), String(r.days), r.status, csvSafe(r.reason ?? '')].join(';'),
    );
    return [header.join(';'), ...lines].join('\n');
  }

  private async notify(employeeId: string, absenceId: string, status: AbsenceStatus) {
    const user = await this.db.user.findUnique({ where: { employeeId } });
    if (user) {
      await this.db.notification.create({
        data: { userId: user.id, type: 'ABSENCE_DECISION', payload: { absenceId, status } },
      });
    }
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Absence', entityId, before: before as object, after: after as object },
    });
  }
}
