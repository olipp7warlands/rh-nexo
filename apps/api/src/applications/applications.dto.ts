import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ContractType } from '@prisma/client';

export class CreateApplicationDto {
  @IsString() candidateId!: string;
  @IsString() jobId!: string;
  /** Fecha de postulación real (AAAA-MM-DD). Por defecto, ahora. Debe ser >= apertura de la oferta. */
  @IsOptional() @IsDateString() appliedAt?: string;
}

/** Corrección de fechas de una candidatura (cargas históricas). Solo ADMIN/RRHH. */
export class UpdateApplicationDto {
  @IsOptional() @IsDateString() appliedAt?: string;
  /** Solo candidaturas CONTRATADO. Debe ser >= fecha de postulación. */
  @IsOptional() @IsDateString() fechaIncorporacion?: string;
}

export class MoveStageDto {
  @IsString() stageId!: string;
}

export class RejectApplicationDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

/** Tipos de entrevista ofrecidos. Se conserva `final` por las ya registradas. */
export const INTERVIEW_TYPES = ['telefonica', 'cultural', 'tecnica', 'final'] as const;

export class AddInterviewDto {
  @IsIn(INTERVIEW_TYPES, { message: 'Tipo de entrevista no válido (telefonica, cultural, tecnica, final).' }) type!: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() interviewerId?: string;
}

export class UpdateInterviewDto {
  @IsOptional() @IsString() @MaxLength(50) status?: string;
  @IsOptional() @IsString() @MaxLength(3000) feedback?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class AddEvaluationDto {
  @IsOptional() @IsNumber() @Min(0) @Max(5) score?: number;
  @IsOptional() @IsString() @MaxLength(2000) strengths?: string;
  @IsOptional() @IsString() @MaxLength(2000) concerns?: string;
  @IsOptional() @IsString() @MaxLength(50) recommendation?: string; // contratar | rechazar | dudoso
}

export class HireDto {
  @IsDateString() startDate!: string;
  @IsOptional() @IsString() @MaxLength(200) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(50) level?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  /** País de la localización; obligatorio solo si `location` no existe todavía y hay que crearla. */
  @IsOptional() @IsString() paisId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() buddyId?: string;
}
