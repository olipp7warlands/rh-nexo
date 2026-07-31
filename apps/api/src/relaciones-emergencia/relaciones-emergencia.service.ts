import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRelacionEmergenciaDto, UpdateRelacionEmergenciaDto } from './relacion-emergencia.dto';

@Injectable()
export class RelacionesEmergenciaService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.relacionEmergencia.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateRelacionEmergenciaDto) {
    return this.db.relacionEmergencia.create({ data: dto });
  }

  async update(id: string, dto: UpdateRelacionEmergenciaDto) {
    await this.findOneOrThrow(id);
    return this.db.relacionEmergencia.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const relacion = await this.db.relacionEmergencia.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!relacion) throw new NotFoundException('Relación de emergencia no encontrada');
    if (relacion._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${relacion._count.empleados} persona(s) siguen usando esta relación.`,
      );
    }
    return this.db.relacionEmergencia.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const relacion = await this.db.relacionEmergencia.findUnique({ where: { id } });
    if (!relacion) throw new NotFoundException('Relación de emergencia no encontrada');
    return relacion;
  }
}
