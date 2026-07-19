import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { CreateCycleDto, CreateObjectiveDto, UpdateKeyResultDto, UpdateReviewDto } from './performance.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('cycles')
  cycles() {
    return this.service.cycles();
  }

  @Roles('ADMIN', 'RRHH')
  @Post('cycles')
  createCycle(@CurrentUser() user: AuthUser, @Body() dto: CreateCycleDto) {
    return this.service.createCycle(dto, user);
  }

  @Get('cycles/:id')
  cycle(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cycle(id, user);
  }

  // Permiso por propiedad (self/manager/RRHH/ADMIN) dentro del servicio.
  @Patch('reviews/:id')
  updateReview(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.service.updateReview(id, dto, user);
  }

  @Get('objectives')
  objectives(@Query('cycleId') cycleId?: string) {
    return this.service.objectives(cycleId);
  }

  @Roles('ADMIN', 'RRHH', 'MANAGER')
  @Post('objectives')
  createObjective(@CurrentUser() user: AuthUser, @Body() dto: CreateObjectiveDto) {
    return this.service.createObjective(dto, user);
  }

  // Permiso por propiedad (owner) o rol elevado dentro del servicio.
  @Patch('key-results/:id')
  updateKeyResult(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateKeyResultDto) {
    return this.service.updateKeyResult(id, dto.progress, user);
  }
}
