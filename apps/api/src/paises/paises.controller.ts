import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaisesService } from './paises.service';
import { CreatePaisDto } from './pais.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

// Catálogo: lectura para cualquier usuario autenticado (JwtAuthGuard global); alta solo ADMIN/RRHH.
@Controller('paises')
export class PaisesController {
  constructor(private readonly service: PaisesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaisDto) {
    return this.service.create(dto, user);
  }
}
