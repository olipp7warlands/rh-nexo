-- CreateTable
CREATE TABLE "RegistroPuesto" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3),
    "titulo" TEXT NOT NULL,
    "sociedadId" TEXT,
    "departamentoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroPuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroSalarial" (
    "id" TEXT NOT NULL,
    "empleadoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "concepto" TEXT NOT NULL,
    "brutoAnual" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroSalarial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RegistroPuesto" ADD CONSTRAINT "RegistroPuesto_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPuesto" ADD CONSTRAINT "RegistroPuesto_sociedadId_fkey" FOREIGN KEY ("sociedadId") REFERENCES "Sociedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroPuesto" ADD CONSTRAINT "RegistroPuesto_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroSalarial" ADD CONSTRAINT "RegistroSalarial_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
