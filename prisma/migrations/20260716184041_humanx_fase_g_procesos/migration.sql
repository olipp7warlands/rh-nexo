-- Fase G — Migración Onboarding→Proceso (RENAME + UPDATE, sin pérdida de datos)
-- Ver fase-g-migration-plan.sql en el histórico de la sesión para el detalle explicado.

BEGIN;

-- 1. Nuevos tipos ENUM
CREATE TYPE "TipoProceso" AS ENUM ('ONBOARDING', 'OFFBOARDING');
CREATE TYPE "EstadoProceso" AS ENUM ('NO_INICIADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO');
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'BLOQUEADA', 'CANCELADA');

-- 2. Renombrar tablas (preserva filas, ids, FKs)
ALTER TABLE "OnboardingTemplate"     RENAME TO "PlantillaProceso";
ALTER TABLE "OnboardingTemplateTask" RENAME TO "PlantillaProcesoTarea";
ALTER TABLE "OnboardingProcess"      RENAME TO "Proceso";
ALTER TABLE "OnboardingTask"         RENAME TO "ProcesoTarea";

-- 3. Renombrar columnas (preserva valores)
ALTER TABLE "PlantillaProceso"      RENAME COLUMN "name"      TO "nombre";

ALTER TABLE "PlantillaProcesoTarea" RENAME COLUMN "templateId" TO "plantillaId";
ALTER TABLE "PlantillaProcesoTarea" RENAME COLUMN "owner"      TO "responsable";
ALTER TABLE "PlantillaProcesoTarea" RENAME COLUMN "order"      TO "orden";

ALTER TABLE "Proceso"               RENAME COLUMN "startDate"  TO "fechaInicio";
ALTER TABLE "Proceso"               RENAME COLUMN "templateId" TO "plantillaId";

ALTER TABLE "ProcesoTarea"          RENAME COLUMN "processId"  TO "procesoId";
ALTER TABLE "ProcesoTarea"          RENAME COLUMN "owner"      TO "responsable";
ALTER TABLE "ProcesoTarea"          RENAME COLUMN "doneAt"     TO "completadaAt";

-- 4. Columnas nuevas con defaults que reflejan los datos actuales
ALTER TABLE "PlantillaProceso" ADD COLUMN "tipo"   "TipoProceso" NOT NULL DEFAULT 'ONBOARDING';
ALTER TABLE "PlantillaProceso" ADD COLUMN "activa" BOOLEAN       NOT NULL DEFAULT true;

ALTER TABLE "Proceso" ADD COLUMN "tipo"          "TipoProceso" NOT NULL DEFAULT 'ONBOARDING';
ALTER TABLE "Proceso" ADD COLUMN "nombre"        TEXT;
ALTER TABLE "Proceso" ADD COLUMN "fechaObjetivo" TIMESTAMP(3);

-- 5. "phase" (enum OnboardingPhase) -> "fase" (texto libre)
ALTER TABLE "PlantillaProcesoTarea" ADD COLUMN "fase" TEXT;
UPDATE "PlantillaProcesoTarea" SET "fase" = CASE "phase"
  WHEN 'ANTES'    THEN 'Antes del primer día'
  WHEN 'DIA1'     THEN 'Primer día'
  WHEN 'SEMANA1'  THEN 'Primera semana'
  WHEN 'MES1'     THEN 'Primer mes'
END;
ALTER TABLE "PlantillaProcesoTarea" ALTER COLUMN "fase" SET NOT NULL;
ALTER TABLE "PlantillaProcesoTarea" DROP COLUMN "phase";

ALTER TABLE "ProcesoTarea" ADD COLUMN "fase" TEXT;
UPDATE "ProcesoTarea" SET "fase" = CASE "phase"
  WHEN 'ANTES'    THEN 'Antes del primer día'
  WHEN 'DIA1'     THEN 'Primer día'
  WHEN 'SEMANA1'  THEN 'Primera semana'
  WHEN 'MES1'     THEN 'Primer mes'
END;
ALTER TABLE "ProcesoTarea" ALTER COLUMN "fase" SET NOT NULL;
ALTER TABLE "ProcesoTarea" DROP COLUMN "phase";

-- 6. "status" (texto libre) -> "estado" (enum EstadoProceso) en Proceso
ALTER TABLE "Proceso" ADD COLUMN "estado" "EstadoProceso" NOT NULL DEFAULT 'EN_CURSO';
UPDATE "Proceso" SET "estado" = "status"::"EstadoProceso" WHERE "status" IN ('NO_INICIADO','EN_CURSO','COMPLETADO','CANCELADO');
ALTER TABLE "Proceso" DROP COLUMN "status";

-- 7. "done" (boolean) -> "estado" (enum EstadoTarea) en ProcesoTarea
ALTER TABLE "ProcesoTarea" ADD COLUMN "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE';
UPDATE "ProcesoTarea" SET "estado" = 'COMPLETADA' WHERE "done" = true;
ALTER TABLE "ProcesoTarea" DROP COLUMN "done";

-- 8. Quitar unicidad employeeId (un empleado puede tener varios procesos)
DROP INDEX "OnboardingProcess_employeeId_key";

-- 9. Borrar el enum viejo, ya sin columnas que lo usen
DROP TYPE "OnboardingPhase";

-- 10. Renombrar constraints para que coincidan con lo que espera Prisma
ALTER TABLE "PlantillaProceso"      RENAME CONSTRAINT "OnboardingTemplate_pkey"     TO "PlantillaProceso_pkey";
ALTER TABLE "PlantillaProcesoTarea" RENAME CONSTRAINT "OnboardingTemplateTask_pkey" TO "PlantillaProcesoTarea_pkey";
ALTER TABLE "Proceso"               RENAME CONSTRAINT "OnboardingProcess_pkey"      TO "Proceso_pkey";
ALTER TABLE "ProcesoTarea"          RENAME CONSTRAINT "OnboardingTask_pkey"         TO "ProcesoTarea_pkey";

ALTER TABLE "PlantillaProcesoTarea" RENAME CONSTRAINT "OnboardingTemplateTask_templateId_fkey" TO "PlantillaProcesoTarea_plantillaId_fkey";
ALTER TABLE "Proceso"               RENAME CONSTRAINT "OnboardingProcess_employeeId_fkey"       TO "Proceso_employeeId_fkey";
ALTER TABLE "Proceso"               RENAME CONSTRAINT "OnboardingProcess_buddyId_fkey"          TO "Proceso_buddyId_fkey";
ALTER TABLE "Proceso"               RENAME CONSTRAINT "OnboardingProcess_templateId_fkey"       TO "Proceso_plantillaId_fkey";
ALTER TABLE "ProcesoTarea"          RENAME CONSTRAINT "OnboardingTask_processId_fkey"           TO "ProcesoTarea_procesoId_fkey";

COMMIT;
