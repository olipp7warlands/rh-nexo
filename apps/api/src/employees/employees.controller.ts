import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EmployeeStatus, Vinculo } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { BajaEmployeeDto, CreateEmployeeDto, UpdateEmployeeDto } from './employee.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

// Protegido por el JwtAuthGuard global; las mutaciones exigen ADMIN/RRHH.
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('vinculo') vinculo?: Vinculo,
    @Query('paisId') paisId?: string,
  ) {
    return this.service.findAll({ search, departmentId, status, vinculo, paisId }, user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(id, user);
  }

  @Get(':id/historico-puestos')
  historicoPuestos(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.historicoPuestos(id, user);
  }

  @Get(':id/historico-salarial')
  historicoSalarial(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.historicoSalarial(id, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.service.create(dto, user.id);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto, user.id);
  }

  @Roles('ADMIN', 'RRHH')
  @Post(':id/baja')
  baja(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BajaEmployeeDto) {
    return this.service.baja(id, dto.fecha, user);
  }
}
