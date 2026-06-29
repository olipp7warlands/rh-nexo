import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly db: PrismaService) {}

  /** Lista de departamentos con su lead y nº de miembros (filtros, selects, organigrama). */
  findAll() {
    return this.db.department.findMany({
      include: {
        lead: { select: { id: true, fullName: true } },
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
