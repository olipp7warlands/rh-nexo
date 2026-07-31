import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateJornadaDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
}

export class UpdateJornadaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
}
