# Fase 1 — Personas (Empleados + Organigrama) · rama `fase-1-personas`

> Fase 0 ✅ commiteada (`1c4a660`). AC Fase 1: crear/editar **persiste** y se refleja en
> directorio, ficha y organigrama; permisos aplicados; cambios auditados.

## Bloque 1 — Backend ✅
- [x] 1a. Módulo `Departments` (GET lista con lead + nº miembros)
- [x] 1b. Empleados `findAll` con filtro por `status` (+ search/departmentId); managerId escalar disponible
- [x] 1c. Tests integración (departamentos, alta persiste+audita, filtro estado, edición persiste+audita)

## Bloque 2 — Lista de Empleados ✅
- [x] 2a. KPIs (Activos/Onboarding/Ausentes/Remoto) + filtro por estado + chips de departamento
- [x] 2b. Columna Antigüedad; fila enlaza a `/empleados/:id`

## Bloque 3 — Alta ✅
- [x] 3a. `useCreateEmployee`
- [x] 3b. Modal "Añadir empleado" (RHF+Zod) con selects de depto/manager desde la API

## Bloque 4 — Editar ✅
- [x] 4a. Modal por pestañas (Personal · Puesto y contrato · Compensación) con `useUpdateEmployee`
- [x] 4b. Compensación (salary/iban) solo editable por ADMIN/RRHH

## Bloque 5 — Ficha (`/empleados/:id`) ✅
- [x] 5. Header + 7 pestañas (Resumen, Info personal, Puesto/contrato, Compensación con datos reales;
      Ausencias muestra saldo real; Documentos/Desempeño = placeholder honesto de fases futuras)

## Bloque 6 — Estado / baja ✅
- [x] 6. Cambio de estado y baja lógica desde la ficha (PATCH/DELETE, auditado), gated ADMIN/RRHH

## Bloque 7 — Organigrama (`/organigrama`) ✅
- [x] 7. Árbol desde `managerId` con CSS `.org-*` (CEO → leads → reportes), nodos enlazan a la ficha

## Bloque 8 — Cierre ✅
- [x] 8. 9/9 tests verde · build web+api OK · filtros/departamentos verificados vía proxy

## Revisión

**Fase 1 completada** en `fase-1-personas`. CRUD de empleados end-to-end con la Definición de Hecho:
- **Persiste + audita** (verificado por tests de integración: alta y edición escriben en BD y `AuditLog`).
- **Permisos**: mutaciones y compensación restringidas a ADMIN/RRHH (backend + UI); salario/IBAN enmascarado.
- **UI** con estados de carga/error, modales accesibles (Esc, foco, labels), validación cliente (Zod) + servidor.
- **Se refleja** en directorio (KPIs + filtros + antigüedad), ficha (7 pestañas) y organigrama (desde `managerId`).

**Verificación**: `pnpm build` (turbo) 2/2 OK · `apps/api` 9/9 tests · departamentos y filtros comprobados
por el proxy del navegador (`:5173/api`).

**Limitación honesta**: no hay MCP de navegador en esta sesión, así que la verificación visual pixel a
pixel del shell/ficha/organigrama queda pendiente de una pasada manual (servidores corriendo en
`:5173` y `:3000`). Backend, tipos, build y persistencia sí están demostrados.

### Siguiente
- Confirmar commit de la Fase 1.
- (Opcional) e2e Playwright del flujo UI si se quiere blindar la capa visual.
- Fase 2: Ausencias (solicitar/aprobar/rechazar/exportar).
