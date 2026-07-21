import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './auth.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser, AuthUser } from './decorators/current-user.decorator';

// 5 intentos por minuto por IP — mucho más estricto que el límite base de la API (auditoría
// A1). Configurable por env (AUTH_THROTTLE_LIMIT) para poder relajarlo en tests, donde un
// mismo proceso hace decenas de logins legítimos de setup en la misma "IP" (127.0.0.1).
export const AUTH_THROTTLE = { default: { limit: Number(process.env.AUTH_THROTTLE_LIMIT ?? 5), ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Pública a propósito (igual que refresh): el propio refreshToken es la credencial que
  // demuestra la sesión a cerrar, no hace falta un access token todavía válido.
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
