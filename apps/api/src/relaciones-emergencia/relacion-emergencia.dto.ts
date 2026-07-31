import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRelacionEmergenciaDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
}

export class UpdateRelacionEmergenciaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
}
