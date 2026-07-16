import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(1) color!: string;
  @IsOptional() @IsString() leadId?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() @MinLength(1) color?: string;
  @IsOptional() @IsString() leadId?: string;
}
