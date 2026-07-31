import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIdiomaDto {
  @IsString() @MinLength(1) @MaxLength(200) nombre!: string;
}

export class UpdateIdiomaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nombre?: string;
}
