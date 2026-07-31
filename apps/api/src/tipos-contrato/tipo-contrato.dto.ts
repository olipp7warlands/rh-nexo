import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTipoContratoDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
}

export class UpdateTipoContratoDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
}
