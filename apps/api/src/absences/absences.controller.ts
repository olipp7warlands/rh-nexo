import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { AbsenceStatus } from '@prisma/client';
import { AbsencesService } from './absences.service';
import { CreateAbsenceDto } from './absence.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('absences')
export class AbsencesController {
  constructor(private readonly service: AbsencesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query('status') status?: AbsenceStatus, @Query('employeeId') employeeId?: string) {
    return this.service.findAll(user, status, employeeId);
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.service.calendar(user, from, to);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ausencias.csv"')
  export(@CurrentUser() user: AuthUser, @Query('status') status?: AbsenceStatus) {
    return this.service.exportCsv(user, status);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAbsenceDto) {
    return this.service.create(dto, user);
  }

  @Roles('MANAGER', 'RRHH', 'ADMIN')
  @Patch(':id/approve')
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.decide(id, user, true);
  }

  @Roles('MANAGER', 'RRHH', 'ADMIN')
  @Patch(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.decide(id, user, false);
  }
}
