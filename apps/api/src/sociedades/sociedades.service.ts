import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertSinReferencias } from '../lib/delete-blockers';
import { CreateSociedadDto, UpdateSociedadDto } from './sociedad.dto';

@Injectable()
export class SociedadesService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.sociedad.findMany({
      include: { pais: true, _count: { select: { empleados: true, jobs: true, registrosPuesto: true } } },
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
      include: { _count: { select: { empleados: true, jobs: true, registrosPuesto: true } } },
    });
    if (!sociedad) throw new NotFoundException('Sociedad no encontrada');
    const x = sociedad;
    assertSinReferencias('la sociedad', [
      { n: x._count.empleados, singular: 'persona', plural: 'personas' },
      { n: x._count.jobs, singular: 'oferta', plural: 'ofertas' },
      { n: x._count.registrosPuesto, singular: 'registro de puesto', plural: 'registros de puesto' },
    ]);
    return this.db.sociedad.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const sociedad = await this.db.sociedad.findUnique({ where: { id } });
    if (!sociedad) throw new NotFoundException('Sociedad no encontrada');
    return sociedad;
  }
}
