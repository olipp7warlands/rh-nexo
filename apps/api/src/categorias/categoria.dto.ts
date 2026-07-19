import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateCategoriaDto {
  @IsString() @MinLength(1) nombre!: string;
  @IsString() @MinLength(1) color!: string;
  @IsOptional() @IsInt() @Min(0) orden?: number;
}

export class UpdateCategoriaDto {
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
  @IsOptional() @IsString() @MinLength(1) color?: string;
  @IsOptional() @IsInt() @Min(0) orden?: number;
}
