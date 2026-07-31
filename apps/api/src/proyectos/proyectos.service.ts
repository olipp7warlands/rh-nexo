import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProyectoDto, UpdateProyectoDto } from './proyecto.dto';

@Injectable()
export class ProyectosService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.proyecto.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateProyectoDto) {
    return this.db.proyecto.create({ data: dto });
  }

  async update(id: string, dto: UpdateProyectoDto) {
    await this.findOneOrThrow(id);
    return this.db.proyecto.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const proyecto = await this.db.proyecto.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    if (proyecto._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${proyecto._count.empleados} persona(s) siguen asignadas a este proyecto.`,
      );
    }
    return this.db.proyecto.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const proyecto = await this.db.proyecto.findUnique({ where: { id } });
    if (!proyecto) throw new NotFoundException('Proyecto no encontrado');
    return proyecto;
  }
}
