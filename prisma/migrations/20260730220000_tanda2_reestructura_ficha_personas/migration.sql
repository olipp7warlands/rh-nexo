-- Tanda 2 (RH feedback): reestructura la ficha de Personas en 5 bloques.
-- Escrita a mano a partir del diff de `prisma migrate diff` (no generada por `migrate dev`,
-- que exige un terminal interactivo para confirmar drops de columnas con datos). Orden:
-- 1) tipos y catálogos nuevos + su seed inicial, 2) columnas nuevas en Employee (nullable),
-- 3) backfill de datos desde las columnas viejas, 4) drop de columnas viejas, 5) columnas
-- clave pasan a NOT NULL, 6) índices y FKs de Employee.

-- ═══════════════════════════ 1. Enums y catálogos nuevos ═══════════════════════════

-- CreateEnum
CREATE TYPE "Nacionalidad" AS ENUM ('ESPANOLA', 'COLOMBIANA', 'MEXICANA', 'EMIRATI', 'INDIA', 'ARGENTINA', 'CHILENA', 'PERUANA', 'PORTUGUESA', 'FRANCESA', 'ALEMANA', 'ITALIANA', 'BRITANICA', 'ESTADOUNIDENSE', 'MARROQUI', 'RUMANA', 'BRASILENA', 'VENEZOLANA', 'ECUATORIANA', 'OTRA');

-- CreateEnum
CREATE TYPE "SituacionIRPF" AS ENUM ('SOLTERO_SIN_HIJOS', 'CASADO_UN_PERCEPTOR', 'CASADO_DOS_PERCEPTORES', 'CON_DESCENDIENTES', 'CON_ASCENDIENTES', 'DISCAPACIDAD', 'FAMILIA_NUMEROSA', 'OTRA');

-- CreateTable
CREATE TABLE "TipoContrato" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "TipoContrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelacionEmergencia" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "RelacionEmergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proyecto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idioma" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Idioma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EmployeeToIdioma" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoContrato_nombre_key" ON "TipoContrato"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Jornada_nombre_key" ON "Jornada"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "RelacionEmergencia_nombre_key" ON "RelacionEmergencia"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_nombre_key" ON "Proyecto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Idioma_nombre_key" ON "Idioma"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "_EmployeeToIdioma_AB_unique" ON "_EmployeeToIdioma"("A", "B");

-- CreateIndex
CREATE INDEX "_EmployeeToIdioma_B_index" ON "_EmployeeToIdioma"("B");

-- AddForeignKey
ALTER TABLE "_EmployeeToIdioma" ADD CONSTRAINT "_EmployeeToIdioma_A_fkey" FOREIGN KEY ("A") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EmployeeToIdioma" ADD CONSTRAINT "_EmployeeToIdioma_B_fkey" FOREIGN KEY ("B") REFERENCES "Idioma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed inicial de catálogos (para que ninguno nazca vacío en producción). `Proyecto` se deja
-- sin sembrar a propósito — lo puebla RH con proyectos reales.
INSERT INTO "TipoContrato" (id, nombre) VALUES
  (gen_random_uuid()::text, 'Indefinido'),
  (gen_random_uuid()::text, 'Temporal'),
  (gen_random_uuid()::text, 'Prácticas'),
  (gen_random_uuid()::text, 'Freelance');

INSERT INTO "Jornada" (id, nombre) VALUES
  (gen_random_uuid()::text, 'Completa'),
  (gen_random_uuid()::text, 'Parcial');

INSERT INTO "RelacionEmergencia" (id, nombre) VALUES
  (gen_random_uuid()::text, 'Cónyuge/Pareja'),
  (gen_random_uuid()::text, 'Padre/Madre'),
  (gen_random_uuid()::text, 'Hijo/a'),
  (gen_random_uuid()::text, 'Hermano/a'),
  (gen_random_uuid()::text, 'Amigo/a'),
  (gen_random_uuid()::text, 'Otro');

INSERT INTO "Idioma" (id, nombre) VALUES
  (gen_random_uuid()::text, 'Español'),
  (gen_random_uuid()::text, 'Inglés'),
  (gen_random_uuid()::text, 'Francés'),
  (gen_random_uuid()::text, 'Portugués');

-- ═══════════════════════════ 2. Columnas nuevas en Employee (nullable) ═══════════════════════════

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN     "certificaciones" TEXT,
ADD COLUMN     "contactoEmergenciaNombre" TEXT,
ADD COLUMN     "contactoEmergenciaRelacionId" TEXT,
ADD COLUMN     "contactoEmergenciaTelefono" TEXT,
ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "horario" TEXT,
ADD COLUMN     "jornadaId" TEXT,
ADD COLUMN     "nacionalidad" "Nacionalidad",
ADD COLUMN     "numSeguridadSocial" TEXT,
ADD COLUMN     "proyectoId" TEXT,
ADD COLUMN     "situacionIRPF" "SituacionIRPF",
ADD COLUMN     "tipoContratoId" TEXT,
ADD COLUMN     "titulacion" TEXT;

-- ═══════════════════════════ 3. Backfill desde las columnas viejas ═══════════════════════════

-- contactoEmergenciaNombre <- emergency (texto libre, copiado tal cual; RH lo reparte luego)
UPDATE "Employee" SET "contactoEmergenciaNombre" = "emergency" WHERE "emergency" IS NOT NULL;

-- localizacionId <- location: crea las Localizacion que falten (comparación insensible a
-- mayúsculas) para las filas que hoy solo tienen el texto libre `location`, luego enlaza.
-- Las filas que ya tenían localizacionId asignado (Fase B "Estructura") no se tocan.
INSERT INTO "Localizacion" (id, nombre)
SELECT gen_random_uuid()::text, loc.nombre
FROM (
  SELECT DISTINCT trim("location") AS nombre
  FROM "Employee"
  WHERE "localizacionId" IS NULL AND "location" IS NOT NULL
) loc
WHERE NOT EXISTS (
  SELECT 1 FROM "Localizacion" l WHERE lower(l.nombre) = lower(loc.nombre)
);

UPDATE "Employee" e
SET "localizacionId" = l.id
FROM "Localizacion" l
WHERE e."localizacionId" IS NULL
  AND e."location" IS NOT NULL
  AND lower(l.nombre) = lower(trim(e."location"));

-- tipoContratoId <- contractType (mapea el enum viejo al catálogo sembrado arriba)
UPDATE "Employee" e
SET "tipoContratoId" = tc.id
FROM "TipoContrato" tc
WHERE e."tipoContratoId" IS NULL
  AND (
    (e."contractType" = 'INDEFINIDO' AND tc.nombre = 'Indefinido') OR
    (e."contractType" = 'TEMPORAL'   AND tc.nombre = 'Temporal') OR
    (e."contractType" = 'PRACTICAS'  AND tc.nombre = 'Prácticas') OR
    (e."contractType" = 'FREELANCE'  AND tc.nombre = 'Freelance')
  );

-- ═══════════════════════════ 4. Elimina las columnas reemplazadas ═══════════════════════════

-- birthday (texto "21 ene" sin año, no migrable a fecha real) y emergency (ya copiado arriba)
-- se pierden a propósito, son datos demo — decisión explícita, ver tasks/todo.md Tanda 2.
-- location y contractType quedan reemplazados por localizacionId/tipoContratoId.
ALTER TABLE "Employee"
DROP COLUMN "birthday",
DROP COLUMN "contractType",
DROP COLUMN "emergency",
DROP COLUMN "location";

-- ═══════════════════════════ 5. Columnas clave pasan a obligatorias ═══════════════════════════

ALTER TABLE "Employee" ALTER COLUMN "localizacionId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "tipoContratoId" SET NOT NULL;

-- localizacionId era opcional con "ON DELETE SET NULL" (Fase B); ahora que es obligatoria ese
-- ON DELETE ya no puede cumplirse (violaría el NOT NULL) — se deja explícito como RESTRICT,
-- mismo criterio que tipoContratoId. El bloqueo real ya vive en el service (409 con empleados
-- asociados); esto es defensa en profundidad a nivel de base de datos.
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_localizacionId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_localizacionId_fkey" FOREIGN KEY ("localizacionId") REFERENCES "Localizacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════ 6. Índices y FKs de Employee ═══════════════════════════

-- CreateIndex
CREATE INDEX "Employee_tipoContratoId_idx" ON "Employee"("tipoContratoId");

-- CreateIndex
CREATE INDEX "Employee_jornadaId_idx" ON "Employee"("jornadaId");

-- CreateIndex
CREATE INDEX "Employee_proyectoId_idx" ON "Employee"("proyectoId");

-- CreateIndex
CREATE INDEX "Employee_contactoEmergenciaRelacionId_idx" ON "Employee"("contactoEmergenciaRelacionId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tipoContratoId_fkey" FOREIGN KEY ("tipoContratoId") REFERENCES "TipoContrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "Jornada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_contactoEmergenciaRelacionId_fkey" FOREIGN KEY ("contactoEmergenciaRelacionId") REFERENCES "RelacionEmergencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
