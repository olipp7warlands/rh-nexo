import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { LocalizacionesService } from './localizaciones.service';
import { CreateLocalizacionDto, UpdateLocalizacionDto } from './localizacion.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

// Lectura para cualquier usuario autenticado; mutaciones solo ADMIN/RRHH.
@Controller('localizaciones')
export class LocalizacionesController {
  constructor(private readonly service: LocalizacionesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLocalizacionDto) {
    return this.service.create(dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateLocalizacionDto) {
    return this.service.update(id, dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
