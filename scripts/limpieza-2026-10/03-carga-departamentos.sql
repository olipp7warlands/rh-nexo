-- PASO 3 — Carga de los 16 departamentos reales. Idempotente (ON CONFLICT (name) DO NOTHING).
-- Uso:  psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f 03-carga-departamentos.sql            (dry-run: ROLLBACK)
--       psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -v commit=true -f 03-carga-departamentos.sql
-- Department solo exige name (unico) y color (NOT NULL). No tenemos color por departamento:
-- se usa el color por defecto de la propia app (#0F1419, DepartmentModal) y se edita despues desde la UI.
-- leadId queda NULL (SET NULL, opcional).
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
DECLARE
  deps constant text[] := ARRAY['Academy','Art','Business Development & Sales','Creativity & Design','Design','Finance',
    'General Management','IT','Legal','Marketing & Communications','Operations','People & Culture','Product Design',
    'Production','Programming','Tech'];
  default_color constant text := '#0F1419';
  bad int; n int; audit_before int; audit_after int; users_before int;
BEGIN
  SELECT count(*) INTO audit_before FROM "AuditLog";
  SELECT count(*) INTO users_before FROM "User";

  -- Preflight
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE email = 'blanca.garcia@wowinx.com' AND "isActive" AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'PREFLIGHT: blanca.garcia no esta activa como ADMIN'; END IF;
  IF cardinality(deps) <> 16 OR (SELECT count(DISTINCT d) FROM unnest(deps) d) <> 16 THEN
    RAISE EXCEPTION 'PREFLIGHT: la lista no tiene 16 nombres distintos'; END IF;
  SELECT count(*) INTO bad FROM "Department" WHERE name <> ALL(deps);
  IF bad > 0 THEN RAISE EXCEPTION 'PREFLIGHT: % departamentos existentes que no estan en la lista (no se toca nada)', bad; END IF;

  INSERT INTO "Department"(id, name, color, "leadId")
  SELECT gen_random_uuid()::text, d, default_color, NULL FROM unnest(deps) AS d
  ON CONFLICT (name) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'departamentos creados: %', n;

  IF n > 0 THEN
    INSERT INTO "AuditLog"(id, "actorId", action, entity, "entityId", before, after, "createdAt")
    VALUES (gen_random_uuid()::text, NULL, 'CREATE', 'Department', 'bulk-load',
            NULL, jsonb_build_object('creados', n, 'motivo', 'carga inicial de departamentos reales (script SQL, sin actor de aplicacion)', 'color', default_color), now());
  END IF;

  -- Postcondiciones
  IF (SELECT count(*) FROM "Department") <> 16 THEN RAISE EXCEPTION 'POST: departamentos finales != 16'; END IF;
  IF (SELECT count(*) FROM "Department" WHERE name = ANY(deps)) <> 16 THEN RAISE EXCEPTION 'POST: faltan nombres de la lista'; END IF;
  IF (SELECT count(*) FROM "User") <> users_before THEN RAISE EXCEPTION 'POST: User cambio'; END IF;
  SELECT count(*) INTO audit_after FROM "AuditLog";
  IF audit_after < audit_before THEN RAISE EXCEPTION 'POST: AuditLog disminuyo'; END IF;
END $$;

\if :{?commit}
  COMMIT;
\else
  ROLLBACK;
\endif
