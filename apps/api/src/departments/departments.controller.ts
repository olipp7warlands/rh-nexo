import { Controller, Get } from '@nestjs/common';
import { DepartmentsService } from './departments.service';

// Lectura para cualquier usuario autenticado (JwtAuthGuard global).
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }
}
