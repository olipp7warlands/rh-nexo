import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJornadaDto, UpdateJornadaDto } from './jornada.dto';

@Injectable()
export class JornadasService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.jornada.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateJornadaDto) {
    return this.db.jornada.create({ data: dto });
  }

  async update(id: string, dto: UpdateJornadaDto) {
    await this.findOneOrThrow(id);
    return this.db.jornada.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const jornada = await this.db.jornada.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${jornada._count.empleados} persona(s) siguen con esta jornada.`,
      );
    }
    return this.db.jornada.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const jornada = await this.db.jornada.findUnique({ where: { id } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    return jornada;
  }
}
