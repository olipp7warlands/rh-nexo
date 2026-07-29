import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días, igual que antes

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Login: valida credenciales (bcrypt) y estado de la cuenta, registra lastLogin y emite tokens. */
  async login(email: string, password: string) {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    return this.issueTokens(user, randomUUID());
  }

  /**
   * Renueva la sesión a partir de un refresh token válido (auditoría A3).
   * Rotación: el token usado se revoca y se emite uno nuevo en la misma familia.
   * Reutilización de un token ya revocado = posible robo → se revoca la familia entera.
   */
  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

    if (!stored) throw new UnauthorizedException('Refresh token inválido o expirado');

    if (stored.revokedAt) {
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException('Sesión revocada por reutilización de un token ya usado. Vuelve a iniciar sesión.');
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
    if (!stored.user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    await this.db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.user, stored.familyId);
  }

  /** Logout real (auditoría A3): revoca toda la familia de refresh tokens de esta sesión. */
  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash } });
    // Idempotente a propósito: token ya revocado/inexistente también responde 204, para no
    // filtrar si un token concreto existía o no.
    if (stored) await this.revokeFamily(stored.familyId);
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

  private async revokeFamily(familyId: string) {
    await this.db.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(user: User, familyId: string) {
    const payload = { sub: user.id, email: user.email, role: user.role, employeeId: user.employeeId };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '15m',
    });

    // Refresh token opaco (no JWT): así solo puede validarse contra la BD, nunca releído sin
    // consultar el registro — condición necesaria para poder revocar/rotar de verdad.
    const refreshToken = randomBytes(32).toString('hex');
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
    };
  }
}
