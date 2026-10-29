import { Controller, Delete, Get, Headers, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CalendarFeedService } from './calendar-feed.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

// Límite propio del feed público, por IP (configurable para los tests): ~60 lecturas/min. Los clientes
// de calendario refrescan cada varias horas, así que es holgado para uso legítimo.
export const FEED_THROTTLE = { default: { limit: Number(process.env.FEED_THROTTLE_LIMIT ?? 60), ttl: 60_000 } };

/** Base pública de la URL del feed: PUBLIC_BASE_URL si está definida; si no, la del propio request. */
function baseUrl(req: Request): string {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/+$/, '');
  const host = (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host');
  return `${req.protocol}://${host}`;
}

@Controller('calendar/feed')
export class CalendarFeedController {
  constructor(private readonly service: CalendarFeedService) {}

  // ── Gestión (autenticada, cada usuario la suya) ─────────────────────────────
  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.service.status(user.id);
  }

  /** Genera o regenera. La URL solo se devuelve aquí, una vez: `no-store`. */
  @Post()
  async generate(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.generate(user, baseUrl(req));
  }

  @Delete()
  revoke(@CurrentUser() user: AuthUser) {
    return this.service.revoke(user);
  }

  // ── Feed público, autorizado por el token de la URL ─────────────────────────
  /**
   * Cualquier fallo (token mal formado, desconocido, revocado, cuenta desactivada) responde el MISMO
   * 404. El token nunca se registra: no se loguea y no aparece en ningún mensaje de error.
   */
  @Public()
  @Throttle(FEED_THROTTLE)
  @Get(':token.ics')
  async feed(
    @Param('token') token: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const feed = await this.service.render(token);
    if (!feed) throw new NotFoundException();
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('ETag', feed.etag);
    if (ifNoneMatch && ifNoneMatch.split(',').map((t) => t.trim()).includes(feed.etag)) {
      res.status(304);
      return;
    }
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="humanx.ics"');
    return feed.body;
  }
}
