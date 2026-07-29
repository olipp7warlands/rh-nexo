import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ContractType } from '@prisma/client';

export class CreateApplicationDto {
  @IsString() candidateId!: string;
  @IsString() jobId!: string;
}

export class MoveStageDto {
  @IsString() stageId!: string;
}

export class RejectApplicationDto {
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}

export class AddInterviewDto {
  @IsString() @MaxLength(50) type!: string; // telefonica | tecnica | cultural | final
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() interviewerId?: string;
}

export class UpdateInterviewDto {
  @IsOptional() @IsString() @MaxLength(50) status?: string;
  @IsOptional() @IsString() @MaxLength(3000) feedback?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class AddEvaluationDto {
  @IsOptional() @IsNumber() @Min(0) @Max(5) score?: number;
  @IsOptional() @IsString() @MaxLength(2000) strengths?: string;
  @IsOptional() @IsString() @MaxLength(2000) concerns?: string;
  @IsOptional() @IsString() @MaxLength(50) recommendation?: string; // contratar | rechazar | dudoso
}

export class HireDto {
  @IsDateString() startDate!: string;
  @IsOptional() @IsString() @MaxLength(200) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(50) level?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() buddyId?: string;
}
