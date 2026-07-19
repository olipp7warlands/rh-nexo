import { Controller, Get } from '@nestjs/common';
import { AgendaService } from './agenda.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

// Protegido por el JwtAuthGuard global; el scope (todo/equipo/propio) lo aplica el service.
@Controller('agenda')
export class AgendaController {
  constructor(private readonly service: AgendaService) {}

  @Get('alertas')
  alertas(@CurrentUser() user: AuthUser) {
    return this.service.alertas(user);
  }
}
