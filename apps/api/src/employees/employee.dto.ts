import { IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ContractType, EmployeeStatus, Vinculo } from '@prisma/client';

export class CreateEmployeeDto {
  @IsString() fullName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() jobTitle!: string;
  @IsString() level!: string;
  @IsString() location!: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsString() startDate!: string; // ISO
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() emergency?: string;
  @IsOptional() @IsString() birthday?: string;
  // humanX: expediente
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsEnum(Vinculo) vinculo?: Vinculo;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() localizacionId?: string;
  @IsOptional() @IsString() finPeriodoPrueba?: string; // ISO
  @IsOptional() @IsString() vencimientoContrato?: string; // ISO
  @IsOptional() @IsString() descripcionPuesto?: string;
}

export class BajaEmployeeDto {
  @IsDateString() fecha!: string; // ISO
}

// Edición parcial: todos los campos opcionales (es lo que hace funcionar "Editar")
export class UpdateEmployeeDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() emergency?: string;
  @IsOptional() @IsString() birthday?: string;
  // humanX: expediente
  @IsOptional() @IsString() codigo?: string;
  @IsOptional() @IsEnum(Vinculo) vinculo?: Vinculo;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() localizacionId?: string;
  @IsOptional() @IsString() finPeriodoPrueba?: string; // ISO
  @IsOptional() @IsString() vencimientoContrato?: string; // ISO
  @IsOptional() @IsString() descripcionPuesto?: string;
}
