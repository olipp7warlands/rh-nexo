# Fase 2 — Tiempo: Ausencias (+ Calendario) · rama `fase-2-ausencias`

> Fases 0 (`1c4a660`) y 1 (`9b668b8`) ✅. AC Fase 2: una solicitud de un empleado aparece en la
> cola del manager/RRHH, se aprueba, baja el saldo y se ve en el calendario; export descarga fichero.

## Bloque 1 — Backend ✅
- [x] 1a. `HolidaysModule` (GET /holidays?location) + 12 festivos 2026 en el seed
- [x] 1b. `AbsencesModule`: POST (días=laborables−festivos, valida saldo, pending+=), GET scoped por rol,
      PATCH approve/reject (ownership manager, ajusta saldo, notifica, audita), GET calendar, GET export(csv)
- [x] 1c. 5 tests integración: días=5, cola del manager, RBAC 403, aprobar mueve pending→used, CSV

## Bloque 2 — Frontend Ausencias ✅
- [x] 2a. Mi saldo + mis solicitudes + "Nueva solicitud" (RHF+Zod, preview de días)
- [x] 2b. `ApprovalQueue` (manager/RRHH): aprobar/rechazar inline
- [x] 2c. Exportar CSV (`downloadFile` con Bearer)

## Bloque 3 — Inicio ✅
- [x] 3. Dashboard: saldo propio + cola de aprobaciones (o mis solicitudes si no aprueba)

## Bloque 4 — Calendario ✅
- [x] 4. Rejilla mensual (lun-primero, nav de mes) con aprobadas del equipo + festivos

## Bloque 5 — Cierre ✅
- [x] 5. 14/14 tests · build turbo 2/2 · scoping verificado vía proxy (manager=equipo, RRHH=todo)

## Revisión

**Fase 2 completada** en `fase-2-ausencias`. Flujo de ausencias end-to-end con Definición de Hecho:
- **Persiste + audita**: crear/aprobar/rechazar escriben en BD y `AuditLog`; decisiones generan `Notification`.
- **Saldo real**: crear suma a `pending`; aprobar mueve `pending→used`; rechazar libera `pending`.
  Validación de saldo insuficiente en servidor. Días = laborables − festivos (por ubicación).
- **Permisos**: EMPLEADO ve/crea lo suyo; MANAGER su equipo (aprueba solo a sus reportes); RRHH/ADMIN todo.
- **UI**: solicitud (preview de días), cola de aprobación (Ausencias + Inicio), calendario mensual, export CSV.

**Verificación**: 14/14 tests integración (5 nuevos de ausencias) · build turbo 2/2 · endpoints y scoping
comprobados vía proxy. Festivos sembrados (12). Limitación: sin verificación visual por navegador (sin MCP).

### Siguiente
- Confirmar commit de Fase 2.
- Fase 3 (Onboarding + Desempeño) o seguir según prioridad.
