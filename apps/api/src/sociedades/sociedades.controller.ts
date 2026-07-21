import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { SociedadesService } from './sociedades.service';
import { CreateSociedadDto, UpdateSociedadDto } from './sociedad.dto';
import { Roles } from '../auth/decorators/roles.decorator';

// Lectura para cualquier usuario autenticado; mutaciones solo ADMIN/RRHH.
@Controller('sociedades')
export class SociedadesController {
  constructor(private readonly service: SociedadesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@Body() dto: CreateSociedadDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSociedadDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
