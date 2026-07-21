import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

const WITH_META = {
  lead: { select: { id: true, fullName: true } },
  _count: { select: { members: true } },
};

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: PrismaService) {}

  /** Lista de departamentos con su lead y nº de miembros (filtros, selects, organigrama). */
  findAll() {
    return this.db.department.findMany({ include: WITH_META, orderBy: { name: 'asc' } });
  }

  async create(dto: CreateDepartmentDto) {
    return this.db.department.create({ data: dto, include: WITH_META });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    await this.findOneOrThrow(id);
    return this.db.department.update({ where: { id }, data: dto, include: WITH_META });
  }

  async remove(id: string) {
    const dept = await this.db.department.findUnique({
      where: { id },
      include: { _count: { select: { members: true } } },
    });
    if (!dept) throw new NotFoundException('Departamento no encontrado');
    if (dept._count.members > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${dept._count.members} persona(s) siguen asignadas a este departamento.`,
      );
    }
    return this.db.department.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const dept = await this.db.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Departamento no encontrado');
    return dept;
  }
}
