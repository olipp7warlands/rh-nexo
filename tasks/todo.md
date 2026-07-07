# Fase 6 — Reclutamiento (VITAE) como módulo interno · rama `fase-6-vitae`

> Fases 0–5 en `master` (`c26a654`, incluye Fase 4 Nómina+Documentos ya fusionada). El modelo
> de datos VITAE ya existía en `schema.prisma` desde la Fase 0 (`Job`, `Candidate`, `Stage`,
> `Application`, `Interview`, `Evaluation`, `AuditDecision`) y el seed ya traía 5 ofertas, un
> pipeline con candidatos y a Sofía Navarro / Raúl Domínguez como contratados de ejemplo.
> Decisión clave: el "cribado automático" es una regla real y determinista (sin CV → descarte;
> con CV → avanza de "Nuevo" a "Cribado"), no una simulación de IA — el schema no tiene campos
> de experiencia/skills y no se ha migrado para añadirlos (decisión explícita del usuario).

## Bloque 1 — Backend Jobs + Candidates
- [x] 1a. `JobsModule`: GET/POST /jobs, GET/PATCH /jobs/:id — RRHH/ADMIN ven y gestionan todas;
      MANAGER solo ve las suyas (`hiringManagerId === viewer.employeeId`)
- [x] 1b. `CandidatesModule`: GET /candidates?search, GET /candidates/:id (ficha con
      applications/interviews/evaluations/decisions), POST /candidates — mismo alcance por rol

## Bloque 2 — Backend Applications (pipeline, cribado, contratación)
- [x] 2a. `ApplicationsModule`: GET /applications?jobId, GET /applications/stages, POST
      /applications, PATCH /:id/stage, PATCH /:id/reject, POST /screen/:jobId (cribado),
      POST /:id/interviews + PATCH /interviews/:id, POST /:id/evaluations
- [x] 2b. **La automatización clave**: POST /applications/:id/hire (solo RRHH/ADMIN) — crea
      `Employee` (enlazado por `candidateId`) + `OnboardingProcess` con la plantilla estándar
      (mismo mapeo de tareas que `OnboardingService.create()`), todo en `$transaction`, con
      `AuditLog` + `AuditDecision(type='HIRE')`
- [x] 2c. Test `vitae.e2e-spec.ts`: alta candidato+candidatura, RBAC (EMPLEADO 403, MANAGER
      ajeno 403, MANAGER dueño sí), cribado automático (descarta sin CV, avanza con CV, traza
      en AuditDecision), avance manual + entrevista + evaluación, contratar → Employee +
      OnboardingProcess (13 tareas) + Application CONTRATADO + auditoría, doble contratación → 400

## Bloque 3 — Frontend
- [x] 3a. `/reclutamiento`: lista de ofertas (tarjetas con conteo por etapa), filtro por
      estado, alta de oferta (RRHH/ADMIN); acceso restringido para EMPLEADO (igual que Informes)
- [x] 3b. `/reclutamiento/:jobId`: tablero Kanban por etapas (botones Avanzar/Rechazar, no
      drag-and-drop), botón "Cribado automático" sobre "Nuevo", alta de candidatura (existente
      o nueva), sección de descartados/retirados
- [x] 3c. Ficha de candidato (modal): entrevistas + evaluaciones + traza de decisiones, botón
      "Contratar" (solo RRHH/ADMIN) → formulario de alta precargado desde la oferta

## Bloque 4 — Cierre
- [x] 4. 45/45 tests en verde (`pnpm --filter @nucleo/api test`) · build api+web OK ·
      verificado en navegador real (Playwright) de punta a punta

## Revisión

**Backend (nuevo):**
- `apps/api/src/jobs/`, `apps/api/src/candidates/`, `apps/api/src/applications/` — tres
  módulos siguiendo el patrón establecido (controller+service+dto, sin imports cruzados entre
  módulos de negocio, todo vía `PrismaService` global).
- `ApplicationsService.hire()` es la pieza central: reimplementa inline (no inyecta
  `EmployeesService`/`OnboardingService` de otros módulos) la creación de `Employee` +
  `OnboardingProcess`/`OnboardingTask` dentro de un único `this.db.$transaction(...)`, para que
  quede genuinamente atómico — algo que los servicios existentes no soportaban porque no
  aceptan un cliente `tx`.
- RBAC: RRHH/ADMIN gestionan todo; MANAGER solo pipeline de sus propias ofertas
  (`hiringManagerId`), puede avanzar/rechazar/entrevistar/evaluar pero no crear ofertas ni
  contratar (reservado a RRHH/ADMIN, mismo criterio que salario/IBAN en el resto del producto);
  EMPLEADO sin acceso a ningún endpoint del módulo.
- Cada decisión de pipeline escribe tanto `AuditLog` (genérico) como `AuditDecision`
  (específico de reclutamiento, con `automated: true/false` — soporte EU AI Act/GDPR).
- `apps/api/test/vitae.e2e-spec.ts` — 10 tests, cubre el flujo completo candidatura →
  cribado → pipeline manual → entrevista/evaluación → contratado → Employee + Onboarding.
  45/45 tests del backend en verde de forma estable.

**Frontend (nuevo):**
- `apps/web/src/features/reclutamiento/` — `useRecruitment.ts` (hooks TanStack Query),
  `ReclutamientoPage.tsx` (lista de ofertas), `JobDetailPage.tsx` (tablero Kanban, ruta
  `/reclutamiento/:jobId`), `CandidatePanel.tsx` + `ContratarModal.tsx` (ficha + contratación),
  `NuevaOfertaModal.tsx`, `NuevaCandidaturaModal.tsx`, `RecruitmentBadges.tsx`.
- El mockup (`docs/mockups/vitae-mockup.html`) tiene vistas mucho más ambiciosas que el encargo
  (ingesta de CVs, un panel "Auto-selección" con prompt de lenguaje natural y confianza IA, un
  dashboard de auditoría con tendencias) — atrezzo con datos falsos sin respaldo de schema, no
  replicado. Se construyó solo lo que pide `PLAN.md`, con la misma paleta/copys donde aplica.
- Verificado en navegador real (Playwright) de punta a punta: como RRHH, crear oferta implícita
  (ya seedeada), dar de alta dos candidaturas (con/sin CV), ejecutar cribado automático (1
  avanza, 1 se descarta), avanzar manualmente por el pipeline, programar entrevista, añadir
  evaluación, contratar (Employee + Onboarding creados, visibles en `/empleados` y contador de
  onboarding); como MANAGER, confirmar que solo ve sus propias ofertas; como EMPLEADO, confirmar
  que el módulo entero devuelve un mensaje de acceso restringido. Cero errores de consola.
- **Bug real detectado y corregido durante la verificación**: `ReclutamientoPage`/
  `JobDetailPage` disparaban sus queries incondicionalmente aunque el viewer no tuviera
  permiso, mostrando una página vacía en silencio para EMPLEADO en vez de un mensaje claro
  (violaba el punto 4 de la Definición de Hecho). Se añadió un flag `enabled` a
  `useJobs`/`useJob`/`useStages`/`useApplicationsByJob` y una comprobación de rol previa,
  replicando el patrón ya usado en `InformesPage.tsx` para Informes (Fase 5).

**Pendiente fuera de alcance (heredado de Fase 5, no tocado en esta rama):**
`ReportsService.overview()` sigue sin transacción (ver detalle en `tasks/lessons.md`) — el
flake ocasional de `reports.e2e-spec.ts` bajo escrituras concurrentes de otras suites persiste;
arreglarlo requiere tocar código de Fase 5, fuera del alcance de Fase 6.

### Siguiente
- Confirmar merge de `fase-6-vitae` a `master` y push.
- Quedan pendientes del `PLAN.md`: Fase 7 (Fichaje, requiere hardware — la última fase).
