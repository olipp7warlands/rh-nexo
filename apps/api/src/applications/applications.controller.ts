import { Body, Controller, Get, Param, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import {
  AddEvaluationDto,
  AddInterviewDto,
  CreateApplicationDto,
  HireDto,
  MoveStageDto,
  RejectApplicationDto,
} from './applications.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Roles('ADMIN', 'RRHH', 'MANAGER')
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Get('stages')
  stages() {
    return this.service.stages();
  }

  @Get()
  findByJob(@CurrentUser() user: AuthUser, @Query('jobId') jobId?: string) {
    if (!jobId) throw new BadRequestException('Falta el parámetro jobId.');
    return this.service.findByJob(jobId, user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApplicationDto) {
    return this.service.create(dto, user);
  }

  @Patch(':id/stage')
  moveStage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveStageDto) {
    return this.service.moveStage(id, dto, user);
  }

  @Patch(':id/reject')
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: RejectApplicationDto) {
    return this.service.reject(id, user, dto.reason);
  }

  @Post('screen/:jobId')
  autoScreen(@CurrentUser() user: AuthUser, @Param('jobId') jobId: string) {
    return this.service.autoScreen(jobId, user);
  }

  @Post(':id/interviews')
  addInterview(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddInterviewDto) {
    return this.service.addInterview(id, dto, user);
  }

  @Post(':id/evaluations')
  addEvaluation(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddEvaluationDto) {
    return this.service.addEvaluation(id, dto, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post(':id/hire')
  hire(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: HireDto) {
    return this.service.hire(id, dto, user);
  }
}
