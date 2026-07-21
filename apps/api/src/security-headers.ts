import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';

/**
 * Auditoría M4: cabeceras de seguridad (CSP, X-Frame-Options, nosniff, HSTS…). Este mismo
 * proceso sirve también el SPA compilado (ServeStaticModule) — la CSP recoge exactamente los
 * orígenes externos reales que usa la app (Google Fonts) y Supabase Storage para las
 * descargas de documentos; 'unsafe-inline' en style-src es necesario porque React escribe
 * estilos inline (`style={{...}}`) en todo el frontend.
 *
 * Extraído a su propia función (en vez de inline en main.ts) para poder aplicar exactamente
 * la misma configuración en los tests e2e, que arrancan la app vía `Test.createTestingModule`
 * y no pasan por `bootstrap()`.
 */
export function applySecurityHeaders(app: INestApplication): void {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https://*.supabase.co'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
}
