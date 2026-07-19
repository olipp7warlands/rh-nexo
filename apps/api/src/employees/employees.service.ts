import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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
    // Registro de accesos: solo en la apertura real de la ficha (con viewer), nunca en las
    // llamadas internas de update()/remove() (que no pasan viewer para el snapshot "before").
    if (viewer) await this.auditView(viewer.id, id);
    return this.maskSensitive(emp, viewer);
  }

  /** Mismo criterio de privacidad que el histórico salarial: ADMIN/RRHH o el propio empleado. */
  historicoPuestos(id: string, viewer: AuthUser) {
    const privilegiado = viewer.role === 'ADMIN' || viewer.role === 'RRHH' || viewer.employeeId === id;
    if (!privilegiado) throw new ForbiddenException('No autorizado para ver el histórico de puestos');
    return this.db.registroPuesto.findMany({
      where: { empleadoId: id },
      include: { sociedad: { include: { pais: true } }, departamento: true },
      orderBy: { fechaInicio: 'desc' },
    });
  }

  /** Mismo criterio de privacidad que el salario en la ficha: ADMIN/RRHH o el propio empleado. */
  historicoSalarial(id: string, viewer: AuthUser) {
    const privilegiado = viewer.role === 'ADMIN' || viewer.role === 'RRHH' || viewer.employeeId === id;
    if (!privilegiado) throw new ForbiddenException('No autorizado para ver el histórico salarial');
    return this.db.registroSalarial.findMany({ where: { empleadoId: id }, orderBy: { fecha: 'desc' } });
  }

  /**
   * Datos personales sensibles (salario, IBAN, DNI, dirección, contacto de emergencia,
   * cumpleaños) solo son visibles para ADMIN/RRHH y el propio empleado — el resto de la
   * plantilla ve la ficha "en blanco" en esos campos. Sin `viewer` (uso interno: antes/después
   * de auditoría) no se enmascara.
   */
  private maskSensitive<
    T extends {
      id: string;
      salary: number | null;
      iban: string | null;
      dni: string | null;
      address: string | null;
      emergency: string | null;
      birthday: string | null;
    },
  >(emp: T, viewer?: AuthUser): T {
    if (!viewer) return emp;
    const privileged =
      viewer.role === 'ADMIN' || viewer.role === 'RRHH' || viewer.employeeId === emp.id;
    return privileged
      ? emp
      : { ...emp, salary: null, iban: null, dni: null, address: null, emergency: null, birthday: null };
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

  /**
   * Dar de baja = dos escrituras que deben caer juntas o ninguna: el estado del empleado pasa
   * a BAJA y se abre su proceso de Offboarding (con la plantilla activa congelada, igual que
   * `ProcesosService.create()`). Antes eran dos llamadas HTTP independientes desde el modal
   * (crear proceso, luego borrar empleado); si la segunda fallaba quedaba un Offboarding
   * huérfano para alguien que seguía figurando como ACTIVO. Todo dentro de `$transaction`.
   */
  async baja(id: string, fecha: string, viewer: AuthUser) {
    const before = await this.db.employee.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Empleado no encontrado');
    if (before.status === 'BAJA') throw new BadRequestException('El empleado ya está de baja');

    const plantilla = await this.db.plantillaProceso.findFirst({
      where: { tipo: 'OFFBOARDING', activa: true },
      include: { tareas: { orderBy: { orden: 'asc' } } },
    });

    return this.db.$transaction(async (tx) => {
      const after = await tx.employee.update({ where: { id }, data: { status: 'BAJA' } });
      const proceso = await tx.proceso.create({
        data: {
          employeeId: id,
          tipo: 'OFFBOARDING',
          plantillaId: plantilla?.id,
          fechaInicio: new Date(fecha),
          tareas: plantilla
            ? { create: plantilla.tareas.map((t) => ({ label: t.label, fase: t.fase, responsable: t.responsable })) }
            : undefined,
        },
        include: { tareas: true },
      });
      await tx.auditLog.create({
        data: { actorId: viewer.id, action: 'DELETE', entity: 'Employee', entityId: id, before, after },
      });
      await tx.auditLog.create({
        data: {
          actorId: viewer.id,
          action: 'CREATE',
          entity: 'Proceso',
          entityId: proceso.id,
          after: { employeeId: id, tipo: 'OFFBOARDING' },
        },
      });
      return { employee: after, proceso };
    });
  }

  private audit(actorId: string | undefined, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Employee', entityId, before: before as object, after: after as object },
    });
  }

  private auditView(actorId: string, entityId: string) {
    return this.db.auditLog.create({ data: { actorId, action: 'VIEW', entity: 'Employee', entityId } });
  }
}
