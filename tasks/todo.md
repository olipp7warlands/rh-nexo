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

---

# Selección — conmutador de vistas + histórico · rama `rh-seleccion-vistas`

## Tanda 1 — Mejora A (conmutador Tarjetas/Listado)
- [x] Control segmentado en `/seleccion` (persistido en `localStorage` `humanx:seleccion-vista`, con try/catch)
- [x] Vista Listado: tabla por oferta, cabeceras ordenables (`aria-sort`), fila clicable + enlace real
- [x] Verificado en navegador (API simulada): alterna, persiste tras recargar, orden y filtro OK · `tsc` limpio

## Tanda 2 — Mejora B (histórico `/seleccion/historico`) · rama `rh-seleccion-historico`
- [x] Migración `20261015121114_seleccion_historico_location_sociedad` (`Candidate.location`, `Job.sociedadId`): aplicada SOLO en dev y verificada. Test y producción pendientes (ciclo de cierre).
- [x] `GET /candidates/historico` solo ADMIN/RRHH (MANAGER/EMPLEADO 403, verificado en runtime). `AuditLog`: una entrada `VIEW`/`CandidateHistory` por consulta con sus filtros (no por fila) y `VIEW`/`Candidate` al abrir una ficha (`GET /candidates/:id`).
- [x] DTOs: `location` (candidato), `sociedadId` (oferta, con 400 si no existe), filtros del histórico validados.
- [x] Modales: Ubicación + LinkedIn en NuevaCandidaturaModal (el input de LinkedIn no existía), Sociedad en NuevaOfertaModal. Ubicación visible en la ficha.
- [x] UI: subpestañas Ofertas / Histórico de candidatos (solo ADMIN/RRHH), `/seleccion/historico`, una fila por candidatura, filtros en la URL (`q`, `puesto`, `sociedad`, `estado`, `desde`, `hasta`, `pagina`), paginación de 25.
- [x] Test `apps/api/test/candidates-historico.e2e-spec.ts` ESCRITO, **NO ejecutado**: espera a migrar la base de test (primer paso del ciclo de cierre). Nunca contra dev.
- [ ] Ciclo de cierre: migrar test → correr suite → backup producción → `migrate deploy` producción → merge.

## Pendiente aparte
- [x] Suite e2e en verde otra vez (2026-10-28, rama `fix/seed-agenda-e-historial-scripts`): las fechas de alerta de `prisma/seed.ts` (fin de prueba y vencimiento) son ahora relativas a «hoy» (+10/+15/+25/+30 días, dentro de la ventana -7/+42 de `agenda.service.ts`). `agenda.e2e-spec.ts` 4/4 y suite completa 174/174 contra la base de test. Causa original: fechas absolutas de jul-ago 2026 que caducaron.
- [ ] Exportar CSV del histórico (valorar dentro de Informes)
- [x] Dev Supabase recreado el 2026-10-15: **nuevo ID `bpoqmytzrymxxsfjiraz`** (el antiguo `dfwwslptvumtmqrlehek` fue eliminado por inactividad). 9 migraciones + seed (17 empleados) + RLS (45/45 tablas) aplicados; procedimiento en lessons.md #21 y `scripts/enable-rls-all.sql`. Pendiente de limpiar: `.claude/settings.local.json` conserva permisos antiguos con la URL (y contraseña) del proyecto eliminado.
- [ ] Índice en `Application(appliedAt)`: añadir solo si el histórico crece (decidido: hoy es ruido)
- [ ] Orden de despliegue de la migración de Tanda 2: dev → test → backup de producción (Supabase → Database → Backups, comprobar uno reciente o lanzar manual) → `migrate deploy` en producción → merge. Generar con `prisma migrate dev --create-only` y comparar con el SQL aprobado; si difiere, enseñarlo de nuevo.
- [ ] Tanda 1: validar visualmente con `pnpm dev:local` (puerto real de Vite) contra dev restaurado ANTES de abrir el PR

# Limpieza de producción (datos demo) · COMPLETADA el 2026-10-28
- [x] Paso 1: 4 cuentas demo desactivadas (`isActive=false`, nunca DELETE) + 18 refresh tokens revocados (4 entradas en `AuditLog`).
- [x] Script 02 (preflight + postcondiciones + idempotente) ensayado en dev y aplicado en producción con `commit=true`: borrados los 17 empleados demo y todo lo colgante, 8 departamentos, 12 festivos, 5 localizaciones, 6 sociedades demo, 2 países (Colombia, México); creadas 14 sociedades reales (7 SL España + 7 FZCO EAU); países = España, EAU, India. `AuditLog` 31 → 32 (+1 `CLEANUP`). Segunda pasada en dry-run: todos los deltas a 0.
- [x] Cuentas activas en producción: `blanca.garcia@wowinx.com` y `oliver.perez@wowinx.com` (ADMIN, sin ficha). Reset de contraseña de Oliver hecho por él con el método interactivo en prod y dev, login verificado (lessons #24).
- [ ] **Recordatorio (~3-4 semanas, a partir del 2026-11-25): borrar `C:/Users/olcas/backups-humanx/prod-pre-limpieza-2026-10-28.sql`** (contiene hashes de contraseña de las cuentas demo). Fuera del repo.
- [ ] Desinstalar el cliente PostgreSQL 16 sobrante (`C:/Users/olcas/pgclient`); se usa el 17 (`pgclient17`) porque Supabase corre 17.x.
- [x] 16 departamentos reales cargados en producción el 2026-10-28 (`scripts/limpieza-2026-10/03-carga-departamentos.sql`, `commit=true`, color `#0F1419`, 0 → 16, segunda pasada a 0). Dev igual.
- [ ] Blanca crea las localizaciones desde la app (Madrid, Dubái, 3 en India).
- [x] Migración de la Tanda 2 de Selección ya en producción desde el 17-oct (verificado el 2026-10-28: 10 migraciones, `Job.sociedadId` y `Candidate.location` existen).

# Siguiente fase: Selección II
- [ ] Migración de festivos (opción B aprobada): `Holiday.paisId` + `Holiday.localizacionId` + `Localizacion.paisId`, con `validado` y `aproximado`; va **unida a la migración de Selección II**, no antes. RLS ya activo en `Holiday` (sin tabla nueva).
- [ ] `AbsencesService.leaveDays` y `GET /holidays`/CalendarioPage pasan a filtrar por país + localización del empleado (con test: India vs Madrid).
- [ ] Calendarios 2026 de fuentes oficiales (BOE/Madrid, EAU, India + Karnataka/Maharashtra/Delhi), cargados como SQL revisado e idempotente marcado «pendiente de validación RRHH», DESPUÉS de crear las localizaciones. 2027 cuando se publique.
- [ ] Suite e2e en rojo (ver «Pendiente aparte» arriba) sigue sin resolver.


# Selección II · Tanda 1 · rama `feat/seleccion-ii-tanda-1` (2026-10-28)
- [x] Migración consolidada `20261028214546_seleccion_ii_fechas_proyecto_festivos_feed` aplicada en dev, test y **producción** (verificado en vivo: `finished_at` 2026-10-28 21:18:35Z, 1 paso, RLS de `ApplicationEtapa` activo, 0 tablas sin RLS). **Sin backup nombrado** (incumplimiento de la lección #23, anotado) y con el ciclo invertido: PR #5 mergeado a las 21:09Z, ~9 min de código sin esquema (lección #25). Tanda 1 DESPLEGADA.
- [x] Fechas reales: `Job.openedAt`/`closedAt` (cierre solo con CERRADA, cierre >= apertura, reabrir => NULL), `Application.appliedAt` editable, `fechaIncorporacion` (hire + PATCH). UI: Nueva oferta, Editar proceso, fecha de postulación, edición de fechas en la ficha, columna «Apertura».
- [x] Histórico: filtros ubicación y proyecto (URL + auditoría) y columnas Proyecto/Incorporación.
- [x] Importación: `scripts/importacion-procesos/` (dry-run/commit, idempotente, email técnico `@candidatos.humanx.invalid`). Plantilla CSV pendiente de entregar a Blanca; CSV real fuera del repo y se borra tras la carga.
- [x] Tests: 24 nuevos; suite e2e 198/198 contra test.
- [ ] Tanda 2: analítica + `ApplicationEtapa` en `moveStage` + festivos (leaveDays, /holidays, calendario) + calendarios 2026. Tanda 3: feed ICS (columnas del token ya en la migración).
- [ ] Aviso: la pantalla de login de dev precarga `admin@grupo.com` (cuenta demo ya inactiva); revisar si el valor por defecto sigue haciendo falta.
