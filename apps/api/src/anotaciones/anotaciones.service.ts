import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoAnotacion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnotacionDto, UpdateAnotacionDto } from './anotacion.dto';

const WITH_RELATIONS = {
  empleado: { select: { id: true, fullName: true, jobTitle: true, sociedad: { select: { nombre: true } } } },
  categoria: true,
  autor: { select: { id: true, email: true, employee: { select: { fullName: true } } } },
};

// Mismo criterio que en employees.service.ts: tope de seguridad, no paginación real todavía.
const DEFAULT_TAKE = 200;

@Injectable()
export class AnotacionesService {
  constructor(private readonly db: PrismaService) {}

  findAll(params: {
    empleadoId?: string;
    categoriaId?: string;
    estado?: EstadoAnotacion;
    desde?: string;
    hasta?: string;
    take?: number;
    skip?: number;
  }) {
    const { empleadoId, categoriaId, estado, desde, hasta, take, skip } = params;
    return this.db.anotacion.findMany({
      where: {
        empleadoId: empleadoId || undefined,
        categoriaId: categoriaId || undefined,
        estado: estado || undefined,
        fecha: desde || hasta ? { gte: desde ? new Date(desde) : undefined, lte: hasta ? new Date(hasta) : undefined } : undefined,
      },
      include: WITH_RELATIONS,
      relationLoadStrategy: 'join',
      orderBy: { fecha: 'desc' },
      take: take ?? DEFAULT_TAKE,
      skip,
    });
  }

  async create(dto: CreateAnotacionDto, actorUserId: string) {
    const anotacion = await this.db.anotacion.create({
      data: {
        empleadoId: dto.empleadoId,
        categoriaId: dto.categoriaId || undefined,
        texto: dto.texto,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        autorId: actorUserId,
      },
      include: WITH_RELATIONS,
      relationLoadStrategy: 'join',
    });
    await this.audit(actorUserId, 'CREATE', anotacion.id, null, anotacion);
    return anotacion;
  }

  async update(id: string, dto: UpdateAnotacionDto, actorUserId: string) {
    const before = await this.findOneOrThrow(id);
    const after = await this.db.anotacion.update({
      where: { id },
      data: {
        texto: dto.texto,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        ...(dto.categoriaId !== undefined ? { categoriaId: dto.categoriaId || null } : {}),
      },
      include: WITH_RELATIONS,
      relationLoadStrategy: 'join',
    });
    await this.audit(actorUserId, 'UPDATE', id, before, after);
    return after;
  }

  async marcarHecha(id: string, actorUserId: string) {
    const before = await this.findOneOrThrow(id);
    const after = await this.db.anotacion.update({
      where: { id },
      data: { estado: 'HECHA', hechaAt: new Date() },
      include: WITH_RELATIONS,
      relationLoadStrategy: 'join',
    });
    await this.audit(actorUserId, 'UPDATE', id, before, after);
    return after;
  }

  async reabrir(id: string, actorUserId: string) {
    const before = await this.findOneOrThrow(id);
    const after = await this.db.anotacion.update({
      where: { id },
      data: { estado: 'PENDIENTE', hechaAt: null },
      include: WITH_RELATIONS,
      relationLoadStrategy: 'join',
    });
    await this.audit(actorUserId, 'UPDATE', id, before, after);
    return after;
  }

  async remove(id: string, actorUserId: string) {
    const before = await this.findOneOrThrow(id);
    await this.db.anotacion.delete({ where: { id } });
    await this.audit(actorUserId, 'DELETE', id, before, null);
    return { id };
  }

  private async findOneOrThrow(id: string) {
    const anotacion = await this.db.anotacion.findUnique({
      where: { id },
      include: WITH_RELATIONS,
      relationLoadStrategy: 'join',
    });
    if (!anotacion) throw new NotFoundException('Anotación no encontrada');
    return anotacion;
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Anotacion', entityId, before: before as object, after: after as object },
    });
  }
}
