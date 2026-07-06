# Fase 4 — Empresa: Nómina + Documentos · rama `fase-4-nomina-docs`

> Fases 0–3+5 en `master` (`55d2d72`). AC: procesar nómina deja registros con su PDF; firmar
> un documento cambia su estado y queda auditado; el export genera un fichero válido.
> Decisiones: nómina = HTML imprimible (sin lib PDF/MinIO); firma = SignatureProvider mock;
> alta de documento = metadatos + fileUrl mock.

## Bloque 1 — Backend Nómina
- [x] 1a. `PayrollModule` (RRHH/ADMIN salvo "mis nóminas"): GET/POST /runs (generar desde salarios),
      GET /runs/:id, POST /runs/:id/items (incidencia, recalcula), PATCH /runs/:id/process (audit),
      GET /payslips/:id/document (HTML, scoped), GET /runs/:id/export (CSV gestoría), GET /payroll/mine
- [x] 1b. Test: generar crea payslips; incidencia recalcula; procesar cambia estado + audita

## Bloque 2 — Backend Documentos + Firma
- [x] 2a. `SignatureProvider` (interfaz + mock)
- [x] 2b. `DocumentsModule`: GET /documents?category (scoped), POST /documents (+firmantes),
      GET /templates, GET /documents/mine (firmas), PATCH /signatures/:id/sign (mock, audit, cierra doc)
- [x] 2c. Test: firmar cambia estado + audita; RBAC

## Bloque 3 — Frontend
- [x] 3a. `/nomina`: RRHH → runs, generar, detalle (gross/irpf/ss/net), incidencia, procesar, export, ver nómina;
      EMPLEADO → mis nóminas
- [x] 3b. `/documentos`: lista + filtro categoría; alta (RRHH); mis documentos por firmar (firmar)

## Bloque 4 — Cierre
- [x] 4. Tests verde · build OK · revisión

## Revisión

**Backend (ya existía de una sesión anterior, solo faltaban los tests):**
- `apps/api/test/payroll.e2e-spec.ts` — genera run (periodo nuevo, sin colisión con el
  `2026-06` del seed), RBAC (EMPLEADO 403 en gestión), incidencia recalcula (verificado contra
  la misma fórmula del servicio, no solo "cambió"), procesar → `PROCESADA` + payslips `EMITIDA`
  + `pdfUrl` + audita, procesar dos veces → 400, export CSV con cabecera, `mine` scoped,
  recibo HTML propio vs. ajeno (403).
- `apps/api/test/documents.e2e-spec.ts` — RBAC alta (solo RRHH/ADMIN), alta con firmante →
  `PENDIENTE`, firmante ajeno no puede firmar (403), firmante firma → `FIRMADA` + audita,
  documento se cierra a `FIRMADO` al no quedar firmas pendientes, `mine` lo incluye, firmar
  dos veces → 400.
- 35/35 tests en verde (`pnpm --filter @nucleo/api test`).

**Frontend (nuevo):**
- `apps/web/src/features/payroll/` — `usePayroll.ts` (hooks TanStack Query), `NominaPage.tsx`
  (una sola página con rama por rol, como `AusenciasPage.tsx`: RRHH/ADMIN generan/procesan/
  exportan con KPIs + pestañas Resumen/Nóminas/Incidencias; EMPLEADO ve "Mis nóminas" con
  botón "Ver recibo"), `NuevaNominaModal.tsx`, `NuevaIncidenciaModal.tsx` (la deducción se
  teclea en positivo y el cliente la niega), `PayrollBadges.tsx`.
- `apps/web/src/features/documents/` — `useDocuments.ts`, `DocumentosPage.tsx` (stats + filtro
  categoría + toggle plantillas + botón "Firmar" cuando el viewer tiene una firma pendiente),
  `NuevoDocumentoModal.tsx` (checklist de firmantes), `DocumentBadges.tsx`. Sin icono de
  descarga (`fileUrl` es mock, no hay fichero real — no añadir un botón que no hace nada).
- `apps/web/src/lib/api.ts` → `viewFile()` nuevo (abre el recibo HTML en pestaña nueva sin
  forzar descarga; abre la pestaña en blanco antes del fetch para evitar el bloqueador de
  pop-ups).
- `main.tsx` → `/nomina` y `/documentos` registradas en `PAGES` (ya estaban en `nav.ts`).
- Verificado en navegador real (Playwright headless) de punta a punta: generar nómina,
  incidencia, procesar, exportar CSV, ver recibo; subir documento con firmante; como EMPLEADO,
  ver "Mis nóminas" y firmar un documento pendiente. Cero errores de consola. Se detectó y
  corrigió un bug real durante esta verificación: los KPICards usaban una clase `stat-grid`
  del mockup que nunca se portó a `@nucleo/ui` (solo existe `.stat-card`), así que se
  apilaban en vertical en vez de en rejilla de 4 columnas — cambiado a `grid grid-cols-4
  gap-4`, como en el resto de páginas reales (`InformesPage`, `EmpleadosPage`).

**Pendiente fuera de alcance (Fase 5, no tocado):** `reports.e2e-spec.ts` tiene un flake
preexistente — `ReportsService.overview()` lanza 11 queries independientes vía `Promise.all`
sin transacción, así que si `employees.e2e-spec.ts` inserta/borra su empleado de prueba justo
entre dos de esas queries, los totales pueden ser transitoriamente inconsistentes entre sí.
Se ajustó el test para no depender de un `count()` en vivo (comparaba contra un número
contaminado por esa misma carrera), pero arreglarlo de raíz requiere envolver esas queries en
una transacción de Prisma en `apps/api/src/reports/reports.service.ts` — cambio de Fase 5,
fuera del scope de esta rama. Detalle en `tasks/lessons.md`.
