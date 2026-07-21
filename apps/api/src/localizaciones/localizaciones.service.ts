import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocalizacionDto, UpdateLocalizacionDto } from './localizacion.dto';

@Injectable()
export class LocalizacionesService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.localizacion.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateLocalizacionDto) {
    return this.db.localizacion.create({ data: dto });
  }

  async update(id: string, dto: UpdateLocalizacionDto) {
    await this.findOneOrThrow(id);
    return this.db.localizacion.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const localizacion = await this.db.localizacion.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!localizacion) throw new NotFoundException('Localización no encontrada');
    if (localizacion._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${localizacion._count.empleados} persona(s) siguen asignadas a esta localización.`,
      );
    }
    return this.db.localizacion.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const localizacion = await this.db.localizacion.findUnique({ where: { id } });
    if (!localizacion) throw new NotFoundException('Localización no encontrada');
    return localizacion;
  }
}
