import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { JornadasService } from './jornadas.service';
import { CreateJornadaDto, UpdateJornadaDto } from './jornada.dto';
import { Roles } from '../auth/decorators/roles.decorator';

// Lectura para cualquier usuario autenticado; mutaciones solo ADMIN/RRHH.
@Controller('jornadas')
export class JornadasController {
  constructor(private readonly service: JornadasService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@Body() dto: CreateJornadaDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateJornadaDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
