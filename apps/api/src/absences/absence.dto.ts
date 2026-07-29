import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AbsenceType } from '@prisma/client';

export class CreateAbsenceDto {
  @IsEnum(AbsenceType) type!: AbsenceType;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
