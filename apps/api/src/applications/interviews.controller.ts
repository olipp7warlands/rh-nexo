import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { UpdateInterviewDto } from './applications.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Roles('ADMIN', 'RRHH', 'MANAGER')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly service: ApplicationsService) {}

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateInterviewDto) {
    return this.service.updateInterview(id, dto, user);
  }
}
