import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TipoProceso } from '@prisma/client';
import { ProcesosService } from './procesos.service';
import {
  CreatePlantillaDto,
  CreatePlantillaTareaDto,
  CreateProcesoDto,
  UpdatePlantillaDto,
  UpdatePlantillaTareaDto,
  UpdateProcesoEstadoDto,
  UpdateTareaEstadoDto,
} from './procesos.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('procesos')
export class ProcesosController {
  constructor(private readonly service: ProcesosService) {}

  // --- Plantillas (editor maestro) — declaradas antes de ':id' para que no colisionen. ---

  @Roles('ADMIN', 'RRHH')
  @Get('plantillas')
  plantillas(@Query('tipo') tipo?: TipoProceso) {
    return this.service.plantillas(tipo);
  }

  @Roles('ADMIN', 'RRHH')
  @Get('plantillas/:id')
  plantilla(@Param('id') id: string) {
    return this.service.plantilla(id);
  }

  @Roles('ADMIN', 'RRHH')
  @Post('plantillas')
  createPlantilla(@CurrentUser() user: AuthUser, @Body() dto: CreatePlantillaDto) {
    return this.service.createPlantilla(dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch('plantillas/:id')
  updatePlantilla(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdatePlantillaDto) {
    return this.service.updatePlantilla(id, dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post('plantillas/:id/duplicar')
  duplicarPlantilla(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.duplicarPlantilla(id, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post('plantillas/:id/tareas')
  createTarea(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreatePlantillaTareaDto) {
    return this.service.createTarea(id, dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch('plantillas/tareas/:tareaId')
  updateTarea(@CurrentUser() user: AuthUser, @Param('tareaId') tareaId: string, @Body() dto: UpdatePlantillaTareaDto) {
    return this.service.updateTarea(tareaId, dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Delete('plantillas/tareas/:tareaId')
  removeTarea(@CurrentUser() user: AuthUser, @Param('tareaId') tareaId: string) {
    return this.service.removeTarea(tareaId, user);
  }

  // --- Procesos ---

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('tipo') tipo?: TipoProceso,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.service.findAll(user, tipo, take ? Number(take) : undefined, skip ? Number(skip) : undefined);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(id, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProcesoDto) {
    return this.service.create(dto, user);
  }

  @Roles('ADMIN', 'RRHH', 'MANAGER')
  @Patch(':id/estado')
  updateEstado(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProcesoEstadoDto) {
    return this.service.updateEstado(id, dto.estado, user);
  }

  @Roles('ADMIN', 'RRHH', 'MANAGER')
  @Patch('tareas/:tareaId')
  updateTareaEstado(@CurrentUser() user: AuthUser, @Param('tareaId') tareaId: string, @Body() dto: UpdateTareaEstadoDto) {
    return this.service.updateTareaEstado(tareaId, dto.estado, user);
  }
}
