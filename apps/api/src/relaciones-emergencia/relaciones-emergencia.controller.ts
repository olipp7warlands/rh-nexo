import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RelacionesEmergenciaService } from './relaciones-emergencia.service';
import { CreateRelacionEmergenciaDto, UpdateRelacionEmergenciaDto } from './relacion-emergencia.dto';
import { Roles } from '../auth/decorators/roles.decorator';

// Lectura para cualquier usuario autenticado; mutaciones solo ADMIN/RRHH.
@Controller('relaciones-emergencia')
export class RelacionesEmergenciaController {
  constructor(private readonly service: RelacionesEmergenciaService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@Body() dto: CreateRelacionEmergenciaDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRelacionEmergenciaDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
