import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EstadoAnotacion } from '@prisma/client';
import { AnotacionesService } from './anotaciones.service';
import { CreateAnotacionDto, UpdateAnotacionDto } from './anotacion.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

// Memoria: notas internas de RRHH sobre personas — ADMIN/RRHH exclusivamente.
@Roles('ADMIN', 'RRHH')
@Controller('anotaciones')
export class AnotacionesController {
  constructor(private readonly service: AnotacionesService) {}

  @Get()
  findAll(
    @Query('empleadoId') empleadoId?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('estado') estado?: EstadoAnotacion,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findAll({ empleadoId, categoriaId, estado, desde, hasta });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAnotacionDto) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAnotacionDto) {
    return this.service.update(id, dto, user.id);
  }

  @Patch(':id/hecha')
  marcarHecha(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.marcarHecha(id, user.id);
  }

  @Patch(':id/reabrir')
  reabrir(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.reabrir(id, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(id, user.id);
  }
}
