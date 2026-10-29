import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';

/**
 * Guard global (tras el JWT): una cuenta con contraseña inicial/restablecida (`mustChangePassword`)
 * no puede usar NADA de la API salvo las rutas marcadas con @AllowPasswordChange() (me, cambio de
 * contraseña). Se aplica en el servidor, no solo en la UI: llamar a la API directamente no lo evita.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.mustChangePassword) return true; // rutas públicas (sin user) y cuentas normales
    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;
    throw new ForbiddenException({
      statusCode: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Debes cambiar tu contraseña antes de continuar.',
    });
  }
}
