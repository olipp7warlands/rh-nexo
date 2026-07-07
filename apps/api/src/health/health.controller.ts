import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';

/** Healthcheck para Railway (u otros orquestadores). Sin auth, sin tocar la BD. */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
