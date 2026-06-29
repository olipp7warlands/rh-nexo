import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { CreateProcessDto, ToggleTaskDto } from './onboarding.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly service: OnboardingService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user);
  }

  @Get('templates')
  templates() {
    return this.service.templates();
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.findOne(id, user);
  }

  @Roles('ADMIN', 'RRHH', 'MANAGER')
  @Patch('tasks/:taskId')
  toggleTask(@CurrentUser() user: AuthUser, @Param('taskId') taskId: string, @Body() dto: ToggleTaskDto) {
    return this.service.toggleTask(taskId, dto.done, user);
  }

  @Roles('ADMIN', 'RRHH')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProcessDto) {
    return this.service.create(dto, user);
  }
}
