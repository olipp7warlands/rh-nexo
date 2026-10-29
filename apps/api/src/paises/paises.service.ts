import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { CreatePaisDto } from './pais.dto';

@Injectable()
export class PaisesService {
  constructor(private readonly db: PrismaService) {}

  /** Catálogo de países (selects de Sociedad y Localización, filtro de Personas). */
  findAll() {
    return this.db.pais.findMany({ orderBy: { nombre: 'asc' } });
  }

  /** Alta de un país desde la app. El nombre es único sin distinguir mayúsculas. Auditado. */
  async create(dto: CreatePaisDto, viewer: AuthUser) {
    const existing = await this.db.pais.findFirst({ where: { nombre: { equals: dto.nombre, mode: 'insensitive' } } });
    if (existing) throw new ConflictException(`El país «${existing.nombre}» ya existe.`);
    const pais = await this.db.pais.create({ data: { nombre: dto.nombre } });
    await this.db.auditLog.create({
      data: { actorId: viewer.id, action: 'CREATE', entity: 'Pais', entityId: pais.id, after: pais as object },
    });
    return pais;
  }
}
