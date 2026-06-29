import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/** Restringe un handler/controlador a los roles indicados. La aplica el RolesGuard global. */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
