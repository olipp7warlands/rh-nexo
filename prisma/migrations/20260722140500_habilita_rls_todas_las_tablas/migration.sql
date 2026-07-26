-- Auditoría de seguridad a nivel de BD (Supabase): RLS estaba desactivado en las 37 tablas,
-- en producción, dev y test por igual — confirmado explotable en vivo: una petición GET con la
-- anon key pública a /rest/v1/User devolvía las 5 cuentas completas de producción, incluidos
-- los hashes bcrypt de la contraseña. Mismo resultado en Employee (salario/DNI/IBAN/dirección),
-- Payslip, Document, AuditLog.
--
-- Activar RLS sin ninguna policy deniega por defecto todo acceso a los roles `anon` y
-- `authenticated` de PostgREST (los únicos con bypassrls=false) — no hace falta escribir
-- ninguna policy explícita de "denegar". El backend NO se ve afectado: Prisma conecta vía
-- DATABASE_URL/DIRECT_URL como el rol `postgres` (superusuario, confirmado rolsuper=true),
-- y los superusuarios de Postgres ignoran RLS siempre, con o sin policies. `service_role`
-- (el rol JWT de PostgREST) también tiene bypassrls=true explícito por Supabase, así que
-- tampoco se ve afectado si algún día se usara para leer tablas (hoy solo se usa para Storage).

ALTER TABLE "Absence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Anotacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditDecision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Candidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Categoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KeyResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Localizacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Objective" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pais" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payslip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceCycle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlantillaProceso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlantillaProcesoTarea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proceso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProcesoTarea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RegistroPuesto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RegistroSalarial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sociedad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
