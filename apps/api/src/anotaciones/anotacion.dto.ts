import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAnotacionDto {
  @IsString() empleadoId!: string;
  @IsOptional() @IsString() categoriaId?: string;
  @IsString() @MinLength(1) @MaxLength(2000) texto!: string;
  @IsOptional() @IsString() fecha?: string; // ISO; por defecto ahora
}

export class UpdateAnotacionDto {
  @IsOptional() @IsString() categoriaId?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) texto?: string;
  @IsOptional() @IsString() fecha?: string;
}
