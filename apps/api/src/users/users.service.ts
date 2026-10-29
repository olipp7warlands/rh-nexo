import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { BCRYPT_ROUNDS } from '../auth/auth.service';
import { CreateUserDto } from './users.dto';

// Sin caracteres ambiguos (0/O, 1/l/I): la contraseña se entrega en mano y se teclea.
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_LENGTH = 16;

const USER_SUMMARY = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLogin: true,
  createdAt: true,
  employeeId: true,
  employee: { select: { id: true, fullName: true } },
} satisfies Prisma.UserSelect;

export function generateTemporaryPassword(): string {
  let out = '';
  for (let i = 0; i < TEMP_LENGTH; i++) out += TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)];
  return out;
}

/**
 * Gestión de cuentas (solo ADMIN, ver controller). Reglas:
 *  - Nunca se borra un User: se desactiva (y se revocan sus refresh tokens).
 *  - Un ADMIN no se desactiva ni se cambia el rol a sí mismo.
 *  - Nunca queda el sistema sin un ADMIN activo (se bloquean las filas ADMIN activas con FOR UPDATE
 *    dentro de la transacción para que dos ADMIN no puedan desactivarse mutuamente en carrera).
 *  - La contraseña temporal se devuelve UNA vez y no se guarda en claro en ningún sitio; la
 *    auditoría usa una lista blanca de campos (jamás contraseñas ni hashes).
 */
@Injectable()
export class UsersService {
  constructor(private readonly db: PrismaService) {}

  list(employeeId?: string) {
    return this.db.user.findMany({
      where: employeeId ? { employeeId } : undefined,
      select: USER_SUMMARY,
      orderBy: { email: 'asc' },
    });
  }

  /** Crea la cuenta de una persona con la contraseña temporal; `mustChangePassword` queda activo. */
  async create(dto: CreateUserDto, actor: AuthUser) {
    const employee = await this.db.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Persona no encontrada');
    if (employee.status === 'BAJA') throw new BadRequestException('No se puede dar acceso a una persona dada de baja.');
    const email = employee.email.trim();

    const clash = await this.db.user.findFirst({
      where: { OR: [{ employeeId: employee.id }, { email: { equals: email, mode: 'insensitive' } }] },
      select: { employeeId: true },
    });
    if (clash) {
      throw new ConflictException(
        clash.employeeId === employee.id ? 'Esta persona ya tiene una cuenta.' : 'Ya existe una cuenta con ese email.',
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const user = await this.db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, role: dto.role, employeeId: employee.id, mustChangePassword: true },
        select: USER_SUMMARY,
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'CREATE',
          entity: 'User',
          entityId: created.id,
          after: { email, role: created.role, employeeId: employee.id, isActive: true, mustChangePassword: true },
        },
      });
      return created;
    });
    return { user, temporaryPassword };
  }

  async updateRole(id: string, role: Role, actor: AuthUser) {
    if (id === actor.id) throw new ConflictException('No puedes cambiar tu propio rol.');
    return this.db.$transaction(async (tx) => {
      await this.lockActiveAdmins(tx);
      const target = await this.findOrThrow(tx, id);
      if (target.role === role) return this.summary(tx, id);
      if (target.role === 'ADMIN' && target.isActive) await this.assertAnotherActiveAdmin(tx, id);
      await tx.user.update({ where: { id }, data: { role } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          before: { role: target.role },
          after: { role },
        },
      });
      return this.summary(tx, id);
    });
  }

  async deactivate(id: string, actor: AuthUser) {
    if (id === actor.id) throw new ConflictException('No puedes desactivar tu propia cuenta.');
    return this.db.$transaction(async (tx) => {
      await this.lockActiveAdmins(tx);
      const target = await this.findOrThrow(tx, id);
      if (!target.isActive) throw new ConflictException('La cuenta ya está desactivada.');
      if (target.role === 'ADMIN') await this.assertAnotherActiveAdmin(tx, id);
      await tx.user.update({ where: { id }, data: { isActive: false } });
      // Corta las sesiones vivas: el access token muere solo (JwtStrategy comprueba isActive en cada petición).
      const revoked = await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'DEACTIVATE',
          entity: 'User',
          entityId: id,
          before: { isActive: true },
          after: { isActive: false, sessionsRevoked: revoked.count },
        },
      });
      return this.summary(tx, id);
    });
  }

  async reactivate(id: string, actor: AuthUser) {
    return this.db.$transaction(async (tx) => {
      const target = await this.findOrThrow(tx, id);
      if (target.isActive) throw new ConflictException('La cuenta ya está activa.');
      await tx.user.update({ where: { id }, data: { isActive: true } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'REACTIVATE',
          entity: 'User',
          entityId: id,
          before: { isActive: false },
          after: { isActive: true },
        },
      });
      return this.summary(tx, id);
    });
  }

  /**
   * Restablece la contraseña de otra cuenta (también otro ADMIN: poder inherente al rol, auditado).
   * Sobre la propia cuenta no: para eso está el cambio voluntario con la contraseña actual.
   */
  async resetPassword(id: string, actor: AuthUser) {
    if (id === actor.id) {
      throw new ConflictException('Para cambiar tu propia contraseña usa «Cambiar contraseña».');
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);
    const user = await this.db.$transaction(async (tx) => {
      await this.findOrThrow(tx, id);
      await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date() } });
      const revoked = await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: 'PASSWORD_RESET',
          entity: 'User',
          entityId: id,
          after: { mustChangePassword: true, sessionsRevoked: revoked.count },
        },
      });
      return this.summary(tx, id);
    });
    return { user, temporaryPassword };
  }

  private async findOrThrow(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
    if (!user) throw new NotFoundException('Cuenta no encontrada');
    return user;
  }

  private summary(tx: Prisma.TransactionClient, id: string) {
    return tx.user.findUniqueOrThrow({ where: { id }, select: USER_SUMMARY });
  }

  /** Serializa las operaciones que pueden dejar al sistema sin ADMIN activo. */
  private async lockActiveAdmins(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" = true FOR UPDATE`;
  }

  private async assertAnotherActiveAdmin(tx: Prisma.TransactionClient, excludingId: string) {
    const others = await tx.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: excludingId } } });
    if (others === 0) throw new ConflictException('No se puede dejar el sistema sin un ADMIN activo.');
  }
}
