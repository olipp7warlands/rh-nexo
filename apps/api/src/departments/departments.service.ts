import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSinReferencias } from '../lib/delete-blockers';
import { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

const WITH_META = {
  lead: { select: { id: true, fullName: true } },
  _count: { select: { members: true, jobs: true } },
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
      include: { _count: { select: { members: true, jobs: true } } },
    });
    if (!dept) throw new NotFoundException('Departamento no encontrado');
    assertSinReferencias('el departamento', [
      { n: dept._count.members, singular: 'persona', plural: 'personas' },
      { n: dept._count.jobs, singular: 'oferta', plural: 'ofertas' },
    ]);
    return this.db.department.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const dept = await this.db.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Departamento no encontrado');
    return dept;
  }
}
