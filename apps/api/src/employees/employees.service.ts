import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeStatus, Vinculo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employee.dto';
import { AuthUser } from '../auth/decorators/current-user.decorator';

const WITH_ESTRUCTURA = {
  department: true,
  manager: { select: { id: true, fullName: true } },
  sociedad: { include: { pais: true } },
  localizacion: true,
};

@Injectable()
export class EmployeesService {
  constructor(private readonly db: PrismaService) {}

  async findAll(
    params: {
      search?: string;
      departmentId?: string;
      status?: EmployeeStatus;
      vinculo?: Vinculo;
      paisId?: string;
    },
    viewer?: AuthUser,
  ) {
    const { search, departmentId, status, vinculo, paisId } = params;
    const employees = await this.db.employee.findMany({
      where: {
        departmentId: departmentId || undefined,
        status: status || undefined,
        vinculo: vinculo || undefined,
        sociedad: paisId ? { paisId } : undefined,
        OR: search
          ? [
              { fullName: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: WITH_ESTRUCTURA,
      orderBy: { fullName: 'asc' },
    });
    return employees.map((e) => this.maskSensitive(e, viewer));
  }

  async findOne(id: string, viewer?: AuthUser) {
    const emp = await this.db.employee.findUnique({
      where: { id },
      include: { ...WITH_ESTRUCTURA, reports: true, balances: true },
    });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    return this.maskSensitive(emp, viewer);
  }

  /**
   * Salario e IBAN solo son visibles para ADMIN/RRHH y el propio empleado.
   * Sin `viewer` (uso interno: antes/después de auditoría) no se enmascara.
   */
  private maskSensitive<T extends { id: string; salary: number | null; iban: string | null }>(
    emp: T,
    viewer?: AuthUser,
  ): T {
    if (!viewer) return emp;
    const privileged =
      viewer.role === 'ADMIN' || viewer.role === 'RRHH' || viewer.employeeId === emp.id;
    return privileged ? emp : { ...emp, salary: null, iban: null };
  }

  async create(dto: CreateEmployeeDto, actorUserId?: string) {
    const emp = await this.db.employee.create({
      data: {
        ...dto,
        startDate: new Date(dto.startDate),
        finPeriodoPrueba: dto.finPeriodoPrueba ? new Date(dto.finPeriodoPrueba) : undefined,
        vencimientoContrato: dto.vencimientoContrato ? new Date(dto.vencimientoContrato) : undefined,
      },
    });
    await this.audit(actorUserId, 'CREATE', emp.id, null, emp);
    return emp;
  }

  // Esto es lo que hace funcionar el botón "Editar": persiste + audita.
  async update(id: string, dto: UpdateEmployeeDto, actorUserId?: string) {
    const before = await this.findOne(id);
    const after = await this.db.employee.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.finPeriodoPrueba ? { finPeriodoPrueba: new Date(dto.finPeriodoPrueba) } : {}),
        ...(dto.vencimientoContrato ? { vencimientoContrato: new Date(dto.vencimientoContrato) } : {}),
      },
    });
    await this.audit(actorUserId, 'UPDATE', id, before, after);
    return after;
  }

  async remove(id: string, actorUserId?: string) {
    const before = await this.findOne(id);
    // Baja "lógica" en lugar de borrado (preserva histórico)
    const after = await this.db.employee.update({ where: { id }, data: { status: 'BAJA' } });
    await this.audit(actorUserId, 'DELETE', id, before, after);
    return after;
  }

  private audit(actorId: string | undefined, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Employee', entityId, before: before as object, after: after as object },
    });
  }
}
