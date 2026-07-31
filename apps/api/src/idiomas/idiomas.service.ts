import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIdiomaDto, UpdateIdiomaDto } from './idioma.dto';

@Injectable()
export class IdiomasService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.idioma.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateIdiomaDto) {
    return this.db.idioma.create({ data: dto });
  }

  async update(id: string, dto: UpdateIdiomaDto) {
    await this.findOneOrThrow(id);
    return this.db.idioma.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const idioma = await this.db.idioma.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!idioma) throw new NotFoundException('Idioma no encontrado');
    if (idioma._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${idioma._count.empleados} persona(s) tienen este idioma registrado.`,
      );
    }
    return this.db.idioma.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const idioma = await this.db.idioma.findUnique({ where: { id } });
    if (!idioma) throw new NotFoundException('Idioma no encontrado');
    return idioma;
  }
}
