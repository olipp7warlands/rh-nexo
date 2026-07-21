import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSociedadDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
  @IsString() @MinLength(1) paisId!: string;
}

export class UpdateSociedadDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
  @IsOptional() @IsString() @MinLength(1) paisId?: string;
}
