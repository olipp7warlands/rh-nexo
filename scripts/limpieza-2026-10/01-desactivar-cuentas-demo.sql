-- PASO 1 — Desactivar las 4 cuentas demo (nunca DELETE). Idempotente.
-- Uso:  psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f 01-desactivar-cuentas-demo.sql
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  demo_users text[] := ARRAY['admin@grupo.com','blanca.ruiz@grupo.com','carlos.soto@grupo.com','diego.ortega@grupo.com'];
  n int;
BEGIN
  -- Guarda anti-lockout: debe existir otro ADMIN activo ANTES de cerrar los demo.
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'blanca.garcia@wowinx.com' AND "isActive" AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'blanca.garcia@wowinx.com no existe, esta inactiva o no es ADMIN: aborto para no dejar el sistema sin acceso';
  END IF;

  -- Auditoria primero (solo de las cuentas que realmente cambian => idempotente).
  INSERT INTO "AuditLog"(id, "actorId", action, entity, "entityId", before, after, "createdAt")
  SELECT gen_random_uuid()::text, NULL, 'UPDATE', 'User', u.id,
         jsonb_build_object('isActive', true, 'email', u.email),
         jsonb_build_object('isActive', false, 'motivo', 'limpieza de datos demo (script SQL, sin actor de aplicacion)'),
         now()
  FROM "User" u WHERE u.email = ANY(demo_users) AND u."isActive";

  UPDATE "User" SET "isActive" = false WHERE email = ANY(demo_users) AND "isActive";
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'cuentas demo desactivadas: %', n;

  -- Corta sesiones vivas: revoca refresh tokens (el access token muere solo: jwt.strategy comprueba isActive en cada peticion).
  UPDATE "RefreshToken" SET "revokedAt" = now()
  WHERE "revokedAt" IS NULL AND "userId" IN (SELECT id FROM "User" WHERE email = ANY(demo_users));
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'refresh tokens revocados: %', n;
END $$;

COMMIT;
