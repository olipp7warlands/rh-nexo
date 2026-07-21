import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSociedadDto, UpdateSociedadDto } from './sociedad.dto';

@Injectable()
export class SociedadesService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.sociedad.findMany({
      include: { pais: true, _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateSociedadDto) {
    return this.db.sociedad.create({ data: dto, include: { pais: true } });
  }

  async update(id: string, dto: UpdateSociedadDto) {
    await this.findOneOrThrow(id);
    return this.db.sociedad.update({ where: { id }, data: dto, include: { pais: true } });
  }

  async remove(id: string) {
    const sociedad = await this.db.sociedad.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!sociedad) throw new NotFoundException('Sociedad no encontrada');
    if (sociedad._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${sociedad._count.empleados} persona(s) siguen asignadas a esta sociedad.`,
      );
    }
    return this.db.sociedad.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const sociedad = await this.db.sociedad.findUnique({ where: { id } });
    if (!sociedad) throw new NotFoundException('Sociedad no encontrada');
    return sociedad;
  }
}
