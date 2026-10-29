import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { UpdateHolidayDto } from './holidays.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly service: HolidaysService) {}

  /** Los festivos que aplican al usuario (su localización y su país). */
  @Get()
  findForViewer(@CurrentUser() user: AuthUser) {
    return this.service.findForViewer(user);
  }

  /** Todos, con ámbito y estado de revisión: solo para quien los gestiona. */
  @Roles('ADMIN', 'RRHH')
  @Get('manage')
  findAllForManagement() {
    return this.service.findAllForManagement();
  }

  @Roles('ADMIN', 'RRHH')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    return this.service.update(id, dto, user);
  }
}
