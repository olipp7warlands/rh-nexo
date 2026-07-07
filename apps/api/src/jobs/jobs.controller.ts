import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

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
}
