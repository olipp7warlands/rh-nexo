import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

/**
 * Revisión de un festivo por RRHH: marcarlo validado y/o confirmar su fecha (los lunares se cargan
 * con fecha aproximada y se corrigen cuando se confirman).
 */
export class UpdateHolidayDto {
  @IsOptional() @IsBoolean() validado?: boolean;
  @IsOptional() @IsBoolean() aproximado?: boolean;
  @IsOptional() @IsDateString() date?: string;
}
