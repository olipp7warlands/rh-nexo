import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { EstadoProceso, EstadoTarea, TipoProceso } from '@prisma/client';

const TIPOS: TipoProceso[] = ['ONBOARDING', 'OFFBOARDING'];
const ESTADOS_PROCESO: EstadoProceso[] = ['NO_INICIADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'];
const ESTADOS_TAREA: EstadoTarea[] = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'BLOQUEADA', 'CANCELADA'];

export class CreateProcesoDto {
  @IsString() employeeId!: string;
  @IsIn(TIPOS) tipo!: TipoProceso;
  @IsOptional() @IsString() buddyId?: string;
  @IsOptional() @IsString() plantillaId?: string;
  @IsOptional() @IsString() nombre?: string;
  @IsDateString() fechaInicio!: string;
  @IsOptional() @IsDateString() fechaObjetivo?: string;
}

export class UpdateProcesoEstadoDto {
  @IsIn(ESTADOS_PROCESO) estado!: EstadoProceso;
}

export class UpdateTareaEstadoDto {
  @IsIn(ESTADOS_TAREA) estado!: EstadoTarea;
}

export class CreatePlantillaDto {
  @IsString() @MinLength(2) nombre!: string;
  @IsIn(TIPOS) tipo!: TipoProceso;
}

export class UpdatePlantillaDto {
  @IsOptional() @IsString() @MinLength(2) nombre?: string;
  @IsOptional() @IsBoolean() activa?: boolean;
}

export class CreatePlantillaTareaDto {
  @IsString() @MinLength(1) label!: string;
  @IsString() @MinLength(1) fase!: string;
  @IsString() @MinLength(1) responsable!: string;
  @IsOptional() @IsInt() orden?: number;
}

export class UpdatePlantillaTareaDto {
  @IsOptional() @IsString() @MinLength(1) label?: string;
  @IsOptional() @IsString() @MinLength(1) fase?: string;
  @IsOptional() @IsString() @MinLength(1) responsable?: string;
  @IsOptional() @IsInt() orden?: number;
}
