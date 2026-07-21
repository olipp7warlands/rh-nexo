import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSociedadDto {
  @IsString() @MinLength(1) nombre!: string;
  @IsString() @MinLength(1) paisId!: string;
}

export class UpdateSociedadDto {
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsString() @MinLength(1) paisId?: string;
}
