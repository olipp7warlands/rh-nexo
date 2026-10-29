import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ContractType, JobStatus } from '@prisma/client';

export class CreateJobDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsString() @MaxLength(200) location!: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsString() @MaxLength(50) level!: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsInt() @Min(1) openings?: number;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  /** Descripción estructurada (Feedback RRHH). `description` queda como legado. */
  @IsOptional() @IsString() @MaxLength(5000) objetivoPuesto?: string;
  @IsOptional() @IsString() @MaxLength(5000) funciones?: string;
  @IsOptional() @IsString() @MaxLength(5000) requisitosEducacion?: string;
  @IsOptional() @IsString() @MaxLength(5000) requisitosExperiencia?: string;
  @IsOptional() @IsString() @MaxLength(5000) seValorara?: string;
  @IsOptional() @IsString() hiringManagerId?: string;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() proyectoId?: string;
  /** Estado inicial (permite cargar procesos históricos ya cerrados). Por defecto ABIERTA. */
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  /** Apertura real del proceso (AAAA-MM-DD). Por defecto, hoy. */
  @IsOptional() @IsDateString() openedAt?: string;
  /** Cierre real. Solo con status CERRADA (si falta al cerrar, hoy). Debe ser >= apertura. */
  @IsOptional() @IsDateString() closedAt?: string;
}

export class UpdateJobDto {
  /** Si se envía, no puede quedar vacío (tras recortar espacios). */
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)) @IsString() @IsNotEmpty({ message: 'El título del puesto no puede estar vacío' }) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @IsNotEmpty({ message: 'El departamento no puede estar vacío' }) departmentId?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsOptional() @IsString() @MaxLength(50) level?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsInt() @Min(1) openings?: number;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(5000) objetivoPuesto?: string;
  @IsOptional() @IsString() @MaxLength(5000) funciones?: string;
  @IsOptional() @IsString() @MaxLength(5000) requisitosEducacion?: string;
  @IsOptional() @IsString() @MaxLength(5000) requisitosExperiencia?: string;
  @IsOptional() @IsString() @MaxLength(5000) seValorara?: string;
  @IsOptional() @IsString() hiringManagerId?: string;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() proyectoId?: string;
  @IsOptional() @IsDateString() openedAt?: string;
  /** Solo con status CERRADA; al reabrir la oferta se pone a NULL automáticamente. */
  @IsOptional() @IsDateString() closedAt?: string;
}
