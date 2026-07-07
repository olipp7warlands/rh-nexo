import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CandidateSource } from '@prisma/client';

export class CreateCandidateDto {
  @IsString() fullName!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(CandidateSource) source?: CandidateSource;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsString() resumeUrl?: string;
}
