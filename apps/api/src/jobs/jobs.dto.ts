import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ContractType, JobStatus } from '@prisma/client';

export class CreateJobDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsString() @MaxLength(200) location!: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsString() @MaxLength(50) level!: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsInt() @Min(1) openings?: number;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() hiringManagerId?: string;
}

export class UpdateJobDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsOptional() @IsString() @MaxLength(50) level?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsInt() @Min(1) openings?: number;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() hiringManagerId?: string;
}
