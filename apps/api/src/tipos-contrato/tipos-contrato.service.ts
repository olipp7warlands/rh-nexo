import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTipoContratoDto, UpdateTipoContratoDto } from './tipo-contrato.dto';

@Injectable()
export class TiposContratoService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.tipoContrato.findMany({
      include: { _count: { select: { empleados: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  async create(dto: CreateTipoContratoDto) {
    return this.db.tipoContrato.create({ data: dto });
  }

  async update(id: string, dto: UpdateTipoContratoDto) {
    await this.findOneOrThrow(id);
    return this.db.tipoContrato.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const tipoContrato = await this.db.tipoContrato.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true } } },
    });
    if (!tipoContrato) throw new NotFoundException('Tipo de contrato no encontrado');
    if (tipoContrato._count.empleados > 0) {
      throw new ConflictException(
        `No se puede eliminar: ${tipoContrato._count.empleados} persona(s) siguen con este tipo de contrato.`,
      );
    }
    return this.db.tipoContrato.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const tipoContrato = await this.db.tipoContrato.findUnique({ where: { id } });
    if (!tipoContrato) throw new NotFoundException('Tipo de contrato no encontrado');
    return tipoContrato;
  }
}
