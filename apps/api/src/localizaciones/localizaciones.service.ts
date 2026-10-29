import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSinReferencias } from '../lib/delete-blockers';
import { CreateLocalizacionDto, UpdateLocalizacionDto } from './localizacion.dto';

@Injectable()
export class LocalizacionesService {
  constructor(private readonly db: PrismaService) {}

  findAll() {
    return this.db.localizacion.findMany({
      include: { pais: true, _count: { select: { empleados: true, festivos: true } } },
      orderBy: { nombre: 'asc' },
    });
  }

  private async assertPaisExists(paisId?: string) {
    if (!paisId) return;
    const found = await this.db.pais.findUnique({ where: { id: paisId }, select: { id: true } });
    if (!found) throw new BadRequestException('El país indicado no existe');
  }

  private audit(actorId: string, action: string, entityId: string, before: unknown, after: unknown) {
    return this.db.auditLog.create({
      data: { actorId, action, entity: 'Localizacion', entityId, before: before as object, after: after as object },
    });
  }

  async create(dto: CreateLocalizacionDto, viewer: AuthUser) {
    await this.assertPaisExists(dto.paisId);
    const created = await this.db.localizacion.create({ data: dto, include: { pais: true } });
    await this.audit(viewer.id, 'CREATE', created.id, null, { nombre: created.nombre, paisId: created.paisId });
    return created;
  }

  async update(id: string, dto: UpdateLocalizacionDto, viewer: AuthUser) {
    const before = await this.findOneOrThrow(id);
    await this.assertPaisExists(dto.paisId);
    const updated = await this.db.localizacion.update({ where: { id }, data: dto, include: { pais: true } });
    await this.audit(
      viewer.id,
      'UPDATE',
      id,
      { nombre: before.nombre, paisId: before.paisId },
      { nombre: updated.nombre, paisId: updated.paisId },
    );
    return updated;
  }

  async remove(id: string) {
    const localizacion = await this.db.localizacion.findUnique({
      where: { id },
      include: { _count: { select: { empleados: true, festivos: true } } },
    });
    if (!localizacion) throw new NotFoundException('Localización no encontrada');
    // Los festivos de una localización se borrarían en cascada (FK): se bloquea para que nunca se
    // lleve por delante festivos —validados o no— sin una decisión consciente sobre ellos.
    assertSinReferencias('la localización', [
      { n: localizacion._count.empleados, singular: 'persona', plural: 'personas' },
      { n: localizacion._count.festivos, singular: 'festivo', plural: 'festivos' },
    ]);
    return this.db.localizacion.delete({ where: { id } });
  }

  private async findOneOrThrow(id: string) {
    const localizacion = await this.db.localizacion.findUnique({ where: { id } });
    if (!localizacion) throw new NotFoundException('Localización no encontrada');
    return localizacion;
  }
}
