import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/** Forma del usuario autenticado que la JwtStrategy adjunta a `req.user`. */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
}

/** Inyecta el usuario autenticado en un parámetro del handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
