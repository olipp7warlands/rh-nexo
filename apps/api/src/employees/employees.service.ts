import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto } from './employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly db: PrismaService) {}

  findAll(params: { search?: string; departmentId?: string }) {
    const { search, departmentId } = params;
    return this.db.employee.findMany({
      where: {
        departmentId: departmentId || undefined,
        OR: search
          ? [
              { fullName: { contains: search, mode: 'insensitive' } },
              { jobTitle: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { department: true, manager: { select: { id: true, fullName: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string) {
    const emp = await this.db.employee.findUnique({
      where: { id },
      include: { department: true, manager: true, reports: true, balances: true },
    });
    if (!emp) throw new NotFoundException('Empleado no encontrado');
    return emp;
  }

  async create(dto: CreateEmployeeDto, actorUserId?: string) {
    const emp = await this.db.employee.create({
      data: { ...dto, startDate: new Date(dto.startDate) },
    });
    await this.audit(actorUserId, 'CREATE', emp.id, null, emp);
    return emp;
  }

  // Esto es lo que hace funcionar el botón "Editar": persiste + audita.
  async update(id: string, dto: UpdateEmployeeDto, actorUserId?: string) {
    const before = await this.findOne(id);
    const after = await this.db.employee.update({
      where: { id },
      data: { ...dto, ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}) },
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
