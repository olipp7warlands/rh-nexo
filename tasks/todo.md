# Fase 3 — Talento: Onboarding + Desempeño · rama `fase-3-talento`

> Fases 0–2 ✅ (`1c4a660`, `9b668b8`, `1984295`). AC: completar tareas y evaluaciones persiste y
> mueve los KPIs; los OKRs reflejan el avance real. Definición de Hecho en cada tarea.

## Bloque 1 — Backend Onboarding ✅
- [x] 1a. `OnboardingModule`: GET /onboarding (scoped + progreso), GET /:id, PATCH /tasks/:id (done+audit),
      POST /onboarding (crea desde plantilla), GET /onboarding/templates
- [x] 1b. Test: marcar tarea sube el progreso y persiste

## Bloque 2 — Backend Desempeño ✅
- [x] 2a. `PerformanceModule`: GET/POST /cycles, GET /cycles/:id (reviews+OKRs), PATCH /reviews/:id
      (permiso self/manager/RRHH/ADMIN + audit), POST /objectives, PATCH /key-results/:id (owner/elevado)
- [x] 2b. Tests: review persiste (rating+managerDone), KR progress persiste, RBAC ciclo

## Bloque 3 — Frontend Onboarding ✅
- [x] 3. Lista con % progreso + detalle con checklist por fase (toggle persiste, gated por rol)

## Bloque 4 — Frontend Desempeño ✅
- [x] 4. Selector de ciclo + KPIs, reviews con toggles+rating (self propio / manager elevado), OKRs con KR editables

## Bloque 5 — Cierre ✅
- [x] 5. 18/18 tests · build turbo 2/2 · endpoints verificados vía proxy

## Revisión

**Fase 3 completada** en `fase-3-talento`. Onboarding y Desempeño operativos con Definición de Hecho:
- **Onboarding**: marcar/desmarcar tareas persiste y mueve el % de progreso (KPI). Crear proceso desde plantilla.
- **Desempeño**: reviews (self/manager/1:1 + rating) persisten; OKRs con progreso de Key Results editable.
- **Permisos**: scoping por rol (EMPLEADO propio · MANAGER su equipo · RRHH/ADMIN todo); self-eval por el propio
  empleado; KR editable por owner o rol elevado. Cambios auditados.

**Verificación**: 18/18 tests (4 nuevos de Talento) · build turbo 2/2 · onboarding (7/13, 10/13) y ciclo Q2
(15 reviews, 3 OKRs) comprobados vía proxy. Limitación: sin verificación visual por navegador (sin MCP).

### Siguiente
- Confirmar commit de Fase 3.
- Fase 4 (Nómina + Documentos) o fusión de fases a master.
