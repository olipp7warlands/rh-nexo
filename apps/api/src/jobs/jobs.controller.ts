import { Body, Controller, Delete, Get, Param, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB, en línea con JobsService

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService) {}

  @Roles('ADMIN', 'RRHH', 'MANAGER')
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Roles('ADMIN', 'RRHH', 'MANAGER')
  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(id, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateJobDto) {
    return this.service.create(dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.service.update(id, dto, user);
  }

  /** Solo sin candidaturas (409 si las hay). Auditado. */
  @Roles('ADMIN', 'RRHH')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(id, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post(':id/pdf')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PDF_BYTES } }))
  uploadPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.service.uploadPdf(id, file, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Get(':id/pdf')
  async downloadPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    res.redirect(await this.service.pdfDownloadUrl(id, user));
  }

  @Roles('ADMIN', 'RRHH')
  @Delete(':id/pdf')
  removePdf(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.removePdf(id, user);
  }
}
