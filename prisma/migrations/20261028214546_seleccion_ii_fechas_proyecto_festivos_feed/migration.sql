-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "fechaIncorporacion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Holiday" ADD COLUMN     "aproximado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fuente" TEXT,
ADD COLUMN     "localizacionId" TEXT,
ADD COLUMN     "paisId" TEXT,
ADD COLUMN     "validado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "proyectoId" TEXT;

-- AlterTable
ALTER TABLE "Localizacion" ADD COLUMN     "paisId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "calendarFeedTokenAt" TIMESTAMP(3),
ADD COLUMN     "calendarFeedTokenHash" TEXT;

-- CreateTable
CREATE TABLE "ApplicationEtapa" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byUserId" TEXT,

    CONSTRAINT "ApplicationEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationEtapa_applicationId_enteredAt_idx" ON "ApplicationEtapa"("applicationId", "enteredAt");

-- CreateIndex
CREATE INDEX "Job_proyectoId_idx" ON "Job"("proyectoId");

-- CreateIndex
CREATE INDEX "Job_openedAt_idx" ON "Job"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_calendarFeedTokenHash_key" ON "User"("calendarFeedTokenHash");

-- AddForeignKey
ALTER TABLE "Localizacion" ADD CONSTRAINT "Localizacion_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_localizacionId_fkey" FOREIGN KEY ("localizacionId") REFERENCES "Localizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEtapa" ADD CONSTRAINT "ApplicationEtapa_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEtapa" ADD CONSTRAINT "ApplicationEtapa_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- BLOQUE MANUAL (Prisma no lo genera ni lo sabe expresar en schema.prisma). Ver README.md de
-- esta carpeta: estos objetos NO deben marcarse como deriva ni "arreglarse" con migrate dev.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

-- Rellenos (el ADD COLUMN de arriba dejó openedAt = momento de la migración en las filas previas)
UPDATE "Job" SET "openedAt" = "createdAt";

UPDATE "Application" a SET "fechaIncorporacion" = e."startDate"
  FROM "Employee" e WHERE e."candidateId" = a."candidateId" AND a."status" = 'CONTRATADO';

-- Festivos heredados (dev/test; producción está vacía): por nombre de localización => local;
-- sin location => nacional de España. Las filas que no casen quedan sin ámbito (ver CHECK).
UPDATE "Holiday" h SET "localizacionId" = l."id" FROM "Localizacion" l WHERE h."location" = l."nombre";
UPDATE "Holiday" SET "paisId" = (SELECT "id" FROM "Pais" WHERE "nombre" = 'España')
  WHERE "location" IS NULL AND "localizacionId" IS NULL;

-- Ámbito obligatorio en festivos nuevos. NOT VALID: no revalida filas heredadas que no casen.
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_ambito_chk"
  CHECK ("paisId" IS NOT NULL OR "localizacionId" IS NOT NULL) NOT VALID;

-- Unicidad por ámbito: índices PARCIALES (Prisma no los soporta en el schema).
CREATE UNIQUE INDEX "Holiday_pais_fecha_nombre_key" ON "Holiday"("paisId", "date", "name") WHERE "localizacionId" IS NULL;
CREATE UNIQUE INDEX "Holiday_loc_fecha_nombre_key" ON "Holiday"("localizacionId", "date", "name") WHERE "localizacionId" IS NOT NULL;

-- RLS en la tabla nueva (regla 8 de la Definición de Hecho / lección #20).
ALTER TABLE public."ApplicationEtapa" ENABLE ROW LEVEL SECURITY;
