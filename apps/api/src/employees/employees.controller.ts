import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
    @Query('sociedadId') sociedadId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('startDateFrom') startDateFrom?: string,
    @Query('startDateTo') startDateTo?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.findAll(
      {
        search,
        departmentId,
        status,
        vinculo,
        paisId,
        sociedadId,
        proyectoId,
        startDateFrom,
        startDateTo,
        take: take ? Number(take) : undefined,
        skip: skip ? Number(skip) : undefined,
      },
      user,
    );
  }

  // Declarada antes de ':id' para que "kpis" no se interprete como un id.
  @Get('kpis')
  kpis() {
    return this.service.kpis();
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

  // humanX Tanda 3: Job Description en PDF. Solo ADMIN/RRHH (defensa en profundidad: el
  // frontend ya oculta el botón, pero el endpoint también lo exige por si se llama directo).
  @Roles('ADMIN', 'RRHH')
  @Get(':id/job-description')
  async jobDescription(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName } = await this.service.jobDescriptionPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
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
