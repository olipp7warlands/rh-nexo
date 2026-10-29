import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  pwv?: number; // versión de contraseña con la que se emitió (ver AuthService.issueTokens)
}

/** Valida el access token (Bearer) y proyecta el usuario a `req.user`. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly db: PrismaService,
  ) {
    // Sin fallback: assertSecretsConfigured() (main.ts) ya abortó el arranque si JWT_SECRET
    // no está definido — degradar aquí a un secreto conocido permitiría forjar tokens válidos.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  // Auditoría M6: revalida rol y estado contra la BD en cada request en vez de confiar en las
  // claims firmadas del token. Así, revocar o cambiar el rol de una cuenta surte efecto de
  // inmediato (hasta 15 min antes, con el access token todavía vigente pero ya obsoleto), sin
  // esperar a que caduque el access token. Coste: una consulta extra por request autenticado.
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, employeeId: true, isActive: true, mustChangePassword: true, passwordChangedAt: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sesión inválida');
    }
    // Un cambio/restablecimiento de contraseña invalida los access tokens anteriores. Se compara la
    // versión exacta (ms) en vez del `iat`, que va en segundos y dejaba una ventana de 1 s. Los tokens
    // emitidos antes de existir el claim cuentan como versión 0 (válidos mientras la contraseña no cambie).
    if ((payload.pwv ?? 0) !== (user.passwordChangedAt?.getTime() ?? 0)) {
      throw new UnauthorizedException('Sesión inválida');
    }
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
