import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from './decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthUser['role'];
  employeeId: string | null;
}

/** Valida el access token (Bearer) y proyecta el payload a `req.user`. */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    // Sin fallback: assertSecretsConfigured() (main.ts) ya abortó el arranque si JWT_SECRET
    // no está definido — degradar aquí a un secreto conocido permitiría forjar tokens válidos.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  validate(payload: JwtPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
    };
  }
}
