import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';

/**
 * «Nunca queda el sistema sin un ADMIN activo»: en e2e no se puede ejercitar sin desactivar el ADMIN
 * del seed (que usan otros specs en paralelo), así que se prueba aquí con una BD simulada.
 */
function fakeDb(opts: { target: { role: string; isActive: boolean }; otherActiveAdmins: number }) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 't', ...opts.target }),
      count: vi.fn().mockResolvedValue(opts.otherActiveAdmins),
      update: vi.fn().mockResolvedValue({}),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 't' }),
    },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const db = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { service: new UsersService(db as never), tx };
}
const actor = { id: 'actor', email: 'a@x.com', role: 'ADMIN' as const, employeeId: null, mustChangePassword: false };

describe('UsersService · último ADMIN activo', () => {
  it('bloquea las filas ADMIN activas (FOR UPDATE) antes de decidir', async () => {
    const { service, tx } = fakeDb({ target: { role: 'ADMIN', isActive: true }, otherActiveAdmins: 1 });
    await service.deactivate('t', actor);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 't' }, data: { isActive: false } });
  });

  it('no desactiva al último ADMIN activo (409) ni escribe nada', async () => {
    const { service, tx } = fakeDb({ target: { role: 'ADMIN', isActive: true }, otherActiveAdmins: 0 });
    await expect(service.deactivate('t', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('no baja de rol al último ADMIN activo (409)', async () => {
    const { service, tx } = fakeDb({ target: { role: 'ADMIN', isActive: true }, otherActiveAdmins: 0 });
    await expect(service.updateRole('t', 'RRHH', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('bajar de rol a un no-ADMIN no consulta la regla del último ADMIN', async () => {
    const { service, tx } = fakeDb({ target: { role: 'RRHH', isActive: true }, otherActiveAdmins: 0 });
    await service.updateRole('t', 'MANAGER', actor);
    expect(tx.user.count).not.toHaveBeenCalled();
    expect(tx.user.update).toHaveBeenCalled();
  });

  it('un ADMIN ya desactivado no cuenta como «último ADMIN» al cambiarle el rol', async () => {
    const { service, tx } = fakeDb({ target: { role: 'ADMIN', isActive: false }, otherActiveAdmins: 0 });
    await service.updateRole('t', 'EMPLEADO', actor);
    expect(tx.user.update).toHaveBeenCalled();
  });
});
