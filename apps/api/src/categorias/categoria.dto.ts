import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCategoriaDto {
  @IsString() @MinLength(1) @MaxLength(100) nombre!: string;
  @IsString() @MinLength(1) @MaxLength(20) color!: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) orden?: number;
}

export class UpdateCategoriaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) nombre?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(20) color?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) orden?: number;
}
