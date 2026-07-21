import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(1) @MaxLength(20) color!: string;
  @IsOptional() @IsString() leadId?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) color?: string;
  @IsOptional() @IsString() leadId?: string;
}
