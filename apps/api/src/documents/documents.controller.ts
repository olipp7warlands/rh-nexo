import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DocumentCategory } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './documents.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, en línea con DocumentsService

@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('category') category?: DocumentCategory) {
    return this.service.findAll(user, category);
  }

  @Get('templates')
  templates() {
    return this.service.templates();
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.service.mine(user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.create(dto, file, user);
  }

  // Permiso (propietario, firmante o RRHH/ADMIN) validado en el servicio.
  @Get(':id/download')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const url = await this.service.download(id, user);
    res.redirect(url);
  }

  // Permiso (firmante o RRHH/ADMIN) validado en el servicio.
  @Patch('signatures/:id/sign')
  sign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.sign(id, user);
  }
}
