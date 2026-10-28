import { IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStatus, CandidateSource } from '@prisma/client';

export class CreateCandidateDto {
  @IsString() @MaxLength(200) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsEnum(CandidateSource) source?: CandidateSource;
  @IsOptional() @IsString() @MaxLength(500) linkedinUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) resumeUrl?: string;
}

/** Filtros del histórico transversal de candidaturas (GET /candidates/historico). */
export class HistoricoQueryDto {
  /** Búsqueda por nombre del candidato (contiene, sin distinguir mayúsculas). */
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() @MaxLength(50) jobId?: string;
  @IsOptional() @IsString() @MaxLength(50) sociedadId?: string;
  @IsOptional() @IsString() @MaxLength(50) proyectoId?: string;
  /** Ubicación del candidato (contiene, sin distinguir mayúsculas). */
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsEnum(ApplicationStatus) status?: ApplicationStatus;
  /** Rango sobre la fecha de postulación. `to` es inclusivo (si llega solo la fecha, hasta fin de día). */
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}
