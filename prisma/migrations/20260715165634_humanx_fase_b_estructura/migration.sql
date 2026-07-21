-- CreateEnum
CREATE TYPE "Vinculo" AS ENUM ('PLANTILLA', 'EXTERNO');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "codigo" TEXT,
ADD COLUMN     "descripcionPuesto" TEXT,
ADD COLUMN     "finPeriodoPrueba" TIMESTAMP(3),
ADD COLUMN     "localizacionId" TEXT,
ADD COLUMN     "sociedadId" TEXT,
ADD COLUMN     "vencimientoContrato" TIMESTAMP(3),
ADD COLUMN     "vinculo" "Vinculo" NOT NULL DEFAULT 'PLANTILLA';

-- CreateTable
CREATE TABLE "Pais" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Pais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sociedad" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "paisId" TEXT NOT NULL,

    CONSTRAINT "Sociedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Localizacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Localizacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pais_nombre_key" ON "Pais"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Sociedad_nombre_key" ON "Sociedad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Localizacion_nombre_key" ON "Localizacion"("nombre");

-- AddForeignKey
ALTER TABLE "Sociedad" ADD CONSTRAINT "Sociedad_paisId_fkey" FOREIGN KEY ("paisId") REFERENCES "Pais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_localizacionId_fkey" FOREIGN KEY ("localizacionId") REFERENCES "Localizacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
