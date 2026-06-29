import { SetMetadata } from '@nestjs/common';

/** Marca una ruta como pública (sin JWT). La usa el JwtAuthGuard global. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
