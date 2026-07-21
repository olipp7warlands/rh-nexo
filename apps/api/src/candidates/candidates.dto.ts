import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CandidateSource } from '@prisma/client';

export class CreateCandidateDto {
  @IsString() @MaxLength(200) fullName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsEnum(CandidateSource) source?: CandidateSource;
  @IsOptional() @IsString() @MaxLength(500) linkedinUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) resumeUrl?: string;
}
