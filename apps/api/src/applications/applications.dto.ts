import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ContractType } from '@prisma/client';

export class CreateApplicationDto {
  @IsString() candidateId!: string;
  @IsString() jobId!: string;
}

export class MoveStageDto {
  @IsString() stageId!: string;
}

export class RejectApplicationDto {
  @IsOptional() @IsString() reason?: string;
}

export class AddInterviewDto {
  @IsString() type!: string; // telefonica | tecnica | cultural | final
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsString() interviewerId?: string;
}

export class UpdateInterviewDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() feedback?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
}

export class AddEvaluationDto {
  @IsOptional() @IsNumber() score?: number;
  @IsOptional() @IsString() strengths?: string;
  @IsOptional() @IsString() concerns?: string;
  @IsOptional() @IsString() recommendation?: string; // contratar | rechazar | dudoso
}

export class HireDto {
  @IsDateString() startDate!: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsEnum(ContractType) contractType?: ContractType;
  @IsOptional() @IsInt() @Min(0) salary?: number;
  @IsOptional() @IsString() buddyId?: string;
}
