import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from './categoria.dto';

@Injectable()
export class CategoriasService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.categoria.findMany({
      include: { _count: { select: { anotaciones: true } } },
      orderBy: { orden: 'asc' },
    });
  }

  async create(dto: CreateCategoriaDto) {
    try {
      return await this.db.categoria.create({ data: dto });
    } catch (e) {
      throw this.friendlyNombreConflict(e);
    }
  }

  async update(id: string, dto: UpdateCategoriaDto) {
    await this.findOneOrThrow(id);
    try {
      return await this.db.categoria.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.friendlyNombreConflict(e);
    }
  }

  // El nombre de categoría es único; sin esto, un choque (dos personas creando "al vuelo"
  // la misma categoría casi a la vez) devuelve un 500 genérico de Prisma en vez de un
  // mensaje claro.
  private friendlyNombreConflict(e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Ya existe una categoría con ese nombre.');
    }
    return e;
  }

  // Sin bloqueo: borrar una categoría no borra sus anotaciones, quedan "Sin categoría"
  // (onDelete: SetNull en el modelo Anotacion).
  async remove(id: string) {
    await this.findOneOrThrow(id);
    return this.db.categoria.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const categoria = await this.db.categoria.findUnique({ where: { id } });
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }
}
