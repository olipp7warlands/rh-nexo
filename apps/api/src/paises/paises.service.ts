import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaisesService {
  constructor(private readonly db: PrismaService) {}

  /** Catálogo de países (selects de Sociedad, filtro de Personas). */
  findAll() {
    return this.db.pais.findMany({ orderBy: { nombre: 'asc' } });
  }
}
