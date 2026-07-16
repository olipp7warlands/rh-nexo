import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLocalizacionDto {
  @IsString() @MinLength(1) nombre!: string;
}

export class UpdateLocalizacionDto {
  @IsOptional() @IsString() @MinLength(1) nombre?: string;
}
