import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DocumentCategory } from '@prisma/client';

export class CreateDocumentDto {
  @IsString() name!: string;
  @IsEnum(DocumentCategory) category!: DocumentCategory;
  @IsOptional() @IsString() ownerId?: string;
  // multipart/form-data envía un solo valor repetido como string, no como array — se normaliza.
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : undefined))
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  signerIds?: string[];
}
