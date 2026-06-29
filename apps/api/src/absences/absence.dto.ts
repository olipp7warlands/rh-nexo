import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { AbsenceType } from '@prisma/client';

export class CreateAbsenceDto {
  @IsEnum(AbsenceType) type!: AbsenceType;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() reason?: string;
}
