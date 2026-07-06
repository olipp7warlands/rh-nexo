import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DocumentCategory } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './documents.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

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
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.service.create(dto, user);
  }

  // Permiso (firmante o RRHH/ADMIN) validado en el servicio.
  @Patch('signatures/:id/sign')
  sign(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.sign(id, user);
  }
}
