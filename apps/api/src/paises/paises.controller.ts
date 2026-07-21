import { Controller, Get } from '@nestjs/common';
import { PaisesService } from './paises.service';

// Catálogo de solo lectura para cualquier usuario autenticado (JwtAuthGuard global).
@Controller('paises')
export class PaisesController {
  constructor(private readonly service: PaisesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
