-- CreateIndex
CREATE INDEX "Absence_employeeId_idx" ON "Absence"("employeeId");

-- CreateIndex
CREATE INDEX "Absence_status_idx" ON "Absence"("status");

-- CreateIndex
CREATE INDEX "Absence_startDate_endDate_idx" ON "Absence"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Anotacion_empleadoId_idx" ON "Anotacion"("empleadoId");

-- CreateIndex
CREATE INDEX "Anotacion_categoriaId_idx" ON "Anotacion"("categoriaId");

-- CreateIndex
CREATE INDEX "Anotacion_estado_idx" ON "Anotacion"("estado");

-- CreateIndex
CREATE INDEX "Anotacion_fecha_idx" ON "Anotacion"("fecha");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "Document_ownerId_idx" ON "Document"("ownerId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "DocumentSignature_employeeId_idx" ON "DocumentSignature"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE INDEX "Employee_sociedadId_idx" ON "Employee"("sociedadId");

-- CreateIndex
CREATE INDEX "Employee_localizacionId_idx" ON "Employee"("localizacionId");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE INDEX "Employee_vinculo_idx" ON "Employee"("vinculo");

-- CreateIndex
CREATE INDEX "PayrollItem_runId_employeeId_idx" ON "PayrollItem"("runId", "employeeId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE INDEX "Proceso_employeeId_idx" ON "Proceso"("employeeId");

-- CreateIndex
CREATE INDEX "Proceso_buddyId_idx" ON "Proceso"("buddyId");

-- CreateIndex
CREATE INDEX "Proceso_plantillaId_idx" ON "Proceso"("plantillaId");

-- CreateIndex
CREATE INDEX "Proceso_tipo_idx" ON "Proceso"("tipo");

-- CreateIndex
CREATE INDEX "ProcesoTarea_procesoId_idx" ON "ProcesoTarea"("procesoId");

-- CreateIndex
CREATE INDEX "RegistroPuesto_empleadoId_idx" ON "RegistroPuesto"("empleadoId");

-- CreateIndex
CREATE INDEX "RegistroSalarial_empleadoId_idx" ON "RegistroSalarial"("empleadoId");
