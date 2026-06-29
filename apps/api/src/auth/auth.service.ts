import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Login: valida credenciales (bcrypt), registra lastLogin y emite tokens. */
  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    return this.issueTokens(user);
  }

  /** Renueva la sesión a partir de un refresh token válido. */
  async refresh(refreshToken: string) {
    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    const user = await this.db.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return this.issueTokens(user);
  }

  /** Datos del usuario autenticado (para hidratar la sesión en el cliente). */
  async me(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        employeeId: true,
        employee: { select: { id: true, fullName: true, jobTitle: true } },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: this.config.get<string>('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
    };
  }
}
