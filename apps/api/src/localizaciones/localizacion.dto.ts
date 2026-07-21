import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLocalizacionDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
}

export class UpdateLocalizacionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
}
