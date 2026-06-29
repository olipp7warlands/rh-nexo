import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateProcessDto {
  @IsString() employeeId!: string;
  @IsOptional() @IsString() buddyId?: string;
  @IsOptional() @IsString() templateId?: string;
  @IsDateString() startDate!: string;
}

export class ToggleTaskDto {
  @IsBoolean() done!: boolean;
}
