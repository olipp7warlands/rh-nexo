import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IdiomasService } from './idiomas.service';
import { CreateIdiomaDto, UpdateIdiomaDto } from './idioma.dto';
import { Roles } from '../auth/decorators/roles.decorator';

// Lectura para cualquier usuario autenticado; mutaciones solo ADMIN/RRHH.
@Controller('idiomas')
export class IdiomasController {
  constructor(private readonly service: IdiomasService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@Body() dto: CreateIdiomaDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateIdiomaDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
