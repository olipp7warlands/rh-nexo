import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ContractType, JobStatus } from '@prisma/client';

export class CreateJobDto {
  @IsString() title!: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsString() location!: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsString() level!: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsInt() @Min(1) openings?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() hiringManagerId?: string;
}

export class UpdateJobDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() remote?: boolean;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsInt() @Min(1) openings?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() hiringManagerId?: string;
}
