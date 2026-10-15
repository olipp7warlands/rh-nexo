-- Activa RLS en TODAS las tablas del esquema public (incluye las uniones implícitas de Prisma
-- `_AToB` y `_prisma_migrations`). Dinámico (recorre pg_tables) para no depender de una lista.
-- Idempotente: se puede relanzar sin efecto si ya estaban activas. Sin políticas = acceso
-- denegado a anon/authenticated vía PostgREST; el rol postgres de la API lo ignora (BYPASSRLS).
--
-- Cuándo usarlo: tras recrear una base (dev) con `prisma migrate deploy` + seed — Prisma no
-- activa RLS al crear tablas (ver tasks/lessons.md #20). Ejecutar SOLO contra el proyecto
-- previsto:
--   pnpm exec dotenv -e .env.local -- prisma db execute --file scripts/enable-rls-all.sql --schema prisma/schema.prisma
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
