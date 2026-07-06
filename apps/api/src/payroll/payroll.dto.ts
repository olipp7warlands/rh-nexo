import { IsEnum, IsInt, IsString, Matches } from 'class-validator';
import { PayrollItemType } from '@prisma/client';

export class GenerateRunDto {
  @Matches(/^\d{4}-\d{2}$/, { message: 'El periodo debe tener formato AAAA-MM' })
  period!: string;
}

export class AddItemDto {
  @IsString() employeeId!: string;
  @IsEnum(PayrollItemType) type!: PayrollItemType;
  @IsString() concept!: string;
  @IsInt() amount!: number; // negativo = deducción
}
