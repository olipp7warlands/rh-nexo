import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CreateCategoriaDto, UpdateCategoriaDto } from './categoria.dto';
import { Roles } from '../auth/decorators/roles.decorator';

// Memoria (Anotaciones) es ADMIN/RRHH exclusivamente — igual el catálogo de categorías.
@Roles('ADMIN', 'RRHH')
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateCategoriaDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoriaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
