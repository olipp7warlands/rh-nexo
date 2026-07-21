import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';
import { Roles } from '../auth/decorators/roles.decorator';

// Lectura para cualquier usuario autenticado; mutaciones solo ADMIN/RRHH.
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.update(id, dto);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
