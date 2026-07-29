import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ContractType, EmployeeStatus, Vinculo } from '@prisma/client';

// Auditoría (hallazgo bajo): ningún campo de texto tenía tope de longitud — un payload con
// una cadena enorme en, p. ej., `address` o `descripcionPuesto` se guardaba tal cual (dentro
// del límite de 100kb del body-parser de Express, pero sin ningún control por campo).
export class CreateEmployeeDto {
  @IsString() @MaxLength(200) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MaxLength(200) jobTitle!: string;
  @IsString() @MaxLength(50) level!: string;
  @IsString() @MaxLength(200) location!: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsString() startDate!: string; // ISO
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() @MaxLength(20) dni?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) iban?: string;
  @IsOptional() @IsString() @MaxLength(300) emergency?: string;
  @IsOptional() @IsString() @MaxLength(20) birthday?: string;
  // humanX: expediente
  @IsOptional() @IsString() @MaxLength(50) codigo?: string;
  @IsOptional() @IsEnum(Vinculo) vinculo?: Vinculo;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() localizacionId?: string;
  @IsOptional() @IsString() finPeriodoPrueba?: string; // ISO
  @IsOptional() @IsString() vencimientoContrato?: string; // ISO
  @IsOptional() @IsString() @MaxLength(2000) descripcionPuesto?: string;
}

export class BajaEmployeeDto {
  @IsDateString() fecha!: string; // ISO
}

// Edición parcial: todos los campos opcionales (es lo que hace funcionar "Editar")
export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(200) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(50) level?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() @MaxLength(20) dni?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) iban?: string;
  @IsOptional() @IsString() @MaxLength(300) emergency?: string;
  @IsOptional() @IsString() @MaxLength(20) birthday?: string;
  // humanX: expediente
  @IsOptional() @IsString() @MaxLength(50) codigo?: string;
  @IsOptional() @IsEnum(Vinculo) vinculo?: Vinculo;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() localizacionId?: string;
  @IsOptional() @IsString() finPeriodoPrueba?: string; // ISO
  @IsOptional() @IsString() vencimientoContrato?: string; // ISO
  @IsOptional() @IsString() @MaxLength(2000) descripcionPuesto?: string;
}
