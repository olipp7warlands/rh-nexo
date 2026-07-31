import { IsArray, IsBoolean, IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { EmployeeStatus, Nacionalidad, SituacionIRPF, Vinculo } from '@prisma/client';

// Auditoría (hallazgo bajo): ningún campo de texto tenía tope de longitud — un payload con
// una cadena enorme en, p. ej., `address` o `descripcionPuesto` se guardaba tal cual (dentro
// del límite de 100kb del body-parser de Express, pero sin ningún control por campo).
export class CreateEmployeeDto {
  @IsString() @MaxLength(200) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsString() @MaxLength(200) jobTitle!: string;
  @IsString() @MaxLength(50) level!: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsString() startDate!: string; // ISO
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() @MaxLength(20) dni?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) iban?: string; // bloque 4, ultra-sensible
  // humanX: expediente
  @IsOptional() @IsString() @MaxLength(50) codigo?: string;
  @IsOptional() @IsEnum(Vinculo) vinculo?: Vinculo;
  @IsOptional() @IsString() sociedadId?: string;
  // humanX Tanda 2: "Centro de trabajo" — única fuente de verdad de ubicación, obligatoria.
  @IsString() localizacionId!: string;
  @IsOptional() @IsString() finPeriodoPrueba?: string; // ISO
  @IsOptional() @IsString() vencimientoContrato?: string; // ISO
  @IsOptional() @IsString() @MaxLength(2000) descripcionPuesto?: string;

  // humanX Tanda 2 — bloque 3 "Datos laborales" (vive en "Información profesional")
  @IsString() tipoContratoId!: string;
  @IsOptional() @IsString() jornadaId?: string;
  @IsOptional() @IsString() @MaxLength(100) horario?: string;
  @IsOptional() @IsString() proyectoId?: string;

  // humanX Tanda 2 — bloque 1 "Datos personales"
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsEnum(Nacionalidad) nacionalidad?: Nacionalidad;

  // humanX Tanda 2 — bloque 2 "Contacto de emergencia"
  @IsOptional() @IsString() @MaxLength(200) contactoEmergenciaNombre?: string;
  @IsOptional() @IsString() contactoEmergenciaRelacionId?: string;
  @IsOptional() @IsString() @MaxLength(30) contactoEmergenciaTelefono?: string;

  // humanX Tanda 2 — bloque 4 "Datos administrativos" (ultra-sensible, ver
  // EmployeesService.maskAdminOnly)
  @IsOptional() @IsString() @MaxLength(30) numSeguridadSocial?: string;
  @IsOptional() @IsEnum(SituacionIRPF) situacionIRPF?: SituacionIRPF;

  // humanX Tanda 2 — bloque 5 "Formación"
  @IsOptional() @IsString() @MaxLength(300) titulacion?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) idiomaIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) certificaciones?: string;
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
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsEnum(EmployeeStatus) status?: EmployeeStatus;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsString() @MaxLength(20) dni?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) iban?: string;
  // humanX: expediente
  @IsOptional() @IsString() @MaxLength(50) codigo?: string;
  @IsOptional() @IsEnum(Vinculo) vinculo?: Vinculo;
  @IsOptional() @IsString() sociedadId?: string;
  @IsOptional() @IsString() localizacionId?: string;
  @IsOptional() @IsString() finPeriodoPrueba?: string; // ISO
  @IsOptional() @IsString() vencimientoContrato?: string; // ISO
  @IsOptional() @IsString() @MaxLength(2000) descripcionPuesto?: string;

  // humanX Tanda 2 — bloque 3 "Datos laborales"
  @IsOptional() @IsString() tipoContratoId?: string;
  @IsOptional() @IsString() jornadaId?: string;
  @IsOptional() @IsString() @MaxLength(100) horario?: string;
  @IsOptional() @IsString() proyectoId?: string;

  // humanX Tanda 2 — bloque 1 "Datos personales"
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsEnum(Nacionalidad) nacionalidad?: Nacionalidad;

  // humanX Tanda 2 — bloque 2 "Contacto de emergencia"
  @IsOptional() @IsString() @MaxLength(200) contactoEmergenciaNombre?: string;
  @IsOptional() @IsString() contactoEmergenciaRelacionId?: string;
  @IsOptional() @IsString() @MaxLength(30) contactoEmergenciaTelefono?: string;

  // humanX Tanda 2 — bloque 4 "Datos administrativos" (ultra-sensible)
  @IsOptional() @IsString() @MaxLength(30) numSeguridadSocial?: string;
  @IsOptional() @IsEnum(SituacionIRPF) situacionIRPF?: SituacionIRPF;

  // humanX Tanda 2 — bloque 5 "Formación"
  @IsOptional() @IsString() @MaxLength(300) titulacion?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) idiomaIds?: string[];
  @IsOptional() @IsString() @MaxLength(2000) certificaciones?: string;
}
