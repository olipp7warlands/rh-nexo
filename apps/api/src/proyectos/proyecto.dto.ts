import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProyectoDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
}

export class UpdateProyectoDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
}
