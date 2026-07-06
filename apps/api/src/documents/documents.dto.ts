import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentCategory } from '@prisma/client';

export class CreateDocumentDto {
  @IsString() name!: string;
  @IsEnum(DocumentCategory) category!: DocumentCategory;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsString({ each: true }) signerIds?: string[];
}
