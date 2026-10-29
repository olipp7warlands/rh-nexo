import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLocalizacionDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
  /** Obligatorio al crear desde la API/app; en BD sigue siendo nullable por las filas previas. */
  @IsString() @IsNotEmpty({ message: 'El país es obligatorio' }) paisId!: string;
}

export class UpdateLocalizacionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
  /** Permite asignar país a las localizaciones creadas sin él (o cambiarlo); no se puede vaciar. */
  @IsOptional() @IsString() @IsNotEmpty({ message: 'El país no puede estar vacío' }) paisId?: string;
}
