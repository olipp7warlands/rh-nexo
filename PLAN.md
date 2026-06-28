# Núcleo — Plan de desarrollo por fases

> **De prototipo a producto funcional.** Documento de traspaso a Claude Code.
> Núcleo es el Core de Recursos Humanos del grupo. VITAE es su módulo de reclutamiento.

---

## 1. Dónde estamos y a dónde vamos

**Estado actual.** Tenemos dos prototipos visuales de alta fidelidad (`nucleo-rrhh.html` y `vitae-mockup.html`). Las pantallas, la navegación entre vistas y los datos de ejemplo son reales, pero **ninguna acción persiste**: no hay backend, base de datos ni estado de servidor. Por eso "Editar", "Aprobar", "Nueva solicitud" o "Exportar" no hacen nada todavía.

**Objetivo.** Convertirlo en un producto funcional donde **toda acción persiste**, con datos reales, permisos por rol, validación, y trazabilidad. Todas las secciones desarrolladas y operativas.

**Los mockups son ahora la especificación.** `nucleo-rrhh.html` y `vitae-mockup.html` pasan a ser la **fuente de verdad de UI/UX**: layout, componentes, copys, estados. El sistema de diseño se llama **"Clear"** (tokens más abajo). No hay que rediseñar; hay que **hacer funcionar** lo que ya está diseñado.

---

## 2. Decisiones técnicas (stack)

### Recomendación principal (control fino, pensado para RRHH)
RRHH implica datos sensibles (DNI, IBAN, salarios), RGPD, lógica de nómina y auditoría. Conviene tener control del backend.

| Capa | Tecnología | Por qué |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript + Tailwind** + React Router | Reutiliza el diseño actual casi 1:1 |
| Estado servidor | **TanStack Query** | Cache, refetch, optimistic updates |
| Formularios | **React Hook Form + Zod** | Validación tipada cliente+servidor |
| Backend | **NestJS (Node + TS)** | Estructura modular que mapea 1:1 con los módulos del producto |
| API | **REST** (o **tRPC** si se quiere tipado end-to-end) | — |
| ORM / DB | **Prisma + PostgreSQL** | Migraciones, tipos, seed reproducible |
| Auth | **JWT + refresh token**, RBAC por rol | — |
| Ficheros | **S3-compatible** (R2 / MinIO en local) | Documentos, nóminas en PDF |
| Firma electrónica | Proveedor (Signaturit/DocuSign) **tras una interfaz `SignatureProvider`** | Desacoplado, mockeable |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | Playwright ya está en el flujo |
| Infra | **Docker Compose** en local · deploy en Railway/Render/Fly + Postgres gestionado | — |

### Alternativa rápida (menos backend a mano)
**Supabase** (Postgres + Auth + Storage + RLS + Realtime) con el mismo frontend React. Ideal para iterar muy rápido en fases tempranas. Contrapartida: menos control sobre lógica de nómina/auditoría y reglas complejas. **Sugerencia:** si se prioriza velocidad inicial, arrancar Fases 0–2 en Supabase y valorar migrar el backend a NestJS cuando entren Nómina y Auditoría.

> Decisión a confirmar por el equipo. El resto del plan es válido con cualquiera de las dos opciones.

---

## 3. Arquitectura y estructura del repo

Monorepo (pnpm o turborepo):

```
nucleo/
├── apps/
│   ├── web/                # React + Vite + TS (frontend)
│   └── api/                # NestJS (backend) — omitir si se usa Supabase
├── packages/
│   ├── ui/                 # Design system "Clear": tokens + componentes
│   ├── types/              # DTOs + esquemas Zod compartidos
│   └── config/             # eslint, tsconfig, prettier base
├── prisma/                 # schema.prisma + migraciones + seed.ts
├── docker-compose.yml      # postgres + minio + api
├── CLAUDE.md               # contexto y convenciones para Claude Code
└── PLAN.md                 # este documento
```

**Primer encargo a Claude Code:** crear `CLAUDE.md` con el stack, la estructura, los tokens "Clear", el modelo de datos y la Definición de Hecho. Claude Code lo lee automáticamente en cada sesión y mantiene consistencia.

---

## 4. Modelo de datos (entidades principales)

Agrupado por dominio. Es el esqueleto sobre el que se montan los módulos.

**Identidad y organización**
- `User` — `id, email, passwordHash, role, employeeId, lastLogin`
- `Employee` — `id, fullName, email, phone, jobTitle, departmentId, managerId, level, location, remote, startDate, contractType, status, salary, birthday, dni, address, iban, emergencyContact, fromRecruitment, candidateId?`
- `Department` — `id, name, color, leadId`

**Tiempo**
- `Absence` — `id, employeeId, type, startDate, endDate, days, status, reason, approverId, decidedAt`
- `LeaveBalance` — `id, employeeId, year, total, used, pending` (recalculado al aprobar)
- `Holiday` — `id, date, name, location` (festivos por ubicación)
- `TimeEntry` — `id, employeeId, clockIn, clockOut, source` *(Fase 7, hardware)*

**Talento**
- `OnboardingProcess` — `id, employeeId, buddyId, templateId, startDate, status`
- `OnboardingTask` — `id, processId, label, phase, owner, done, doneAt`
- `OnboardingTemplate` / `TemplateTask`
- `PerformanceCycle` — `id, name, startDate, endDate, status`
- `Review` — `id, cycleId, employeeId, reviewerId, selfDone, managerDone, o2oDone, rating`
- `Objective` (OKR) — `id, cycleId, scope, ownerId, title`
- `KeyResult` — `id, objectiveId, title, progress`

**Empresa**
- `PayrollRun` — `id, period, status, totalGross, totalCost, processedAt`
- `Payslip` — `id, runId, employeeId, gross, irpf, ss, net, status, pdfUrl`
- `PayrollItem` — `id, runId, employeeId, type, concept, amount` (bonus, horas extra, deducciones)
- `Document` — `id, name, category, ownerId, fileUrl, status, createdAt`
- `DocumentSignature` — `id, documentId, employeeId, status, signedAt`
- `DocumentTemplate` — `id, name, category, fileUrl`

**Reclutamiento (VITAE)** — módulo **interno** (no app aparte). Ya está en `schema.prisma` desde el inicio: `Job`, `Candidate`, `Stage`, `Application`, `Interview`, `Evaluation`, `AuditDecision` (traza de decisiones, incl. automáticas, para auditoría / EU AI Act). El enlace candidato→empleado es `Employee.candidateId` (1:1 con `Candidate`). La funcionalidad se construye en la Fase 6.

**Transversal**
- `AuditLog` — `id, actorId, action, entity, entityId, before, after, createdAt` (RGPD + EU AI Act)
- `Notification` — `id, userId, type, payload, readAt`

---

## 5. Roles y permisos (RBAC)

| Rol | Alcance |
|---|---|
| **Admin** | Todo + configuración del sistema |
| **RRHH** | Todos los empleados, ausencias, nómina, documentos, desempeño, reclutamiento |
| **Manager** | Su equipo: ver fichas, aprobar ausencias, evaluar, ver onboarding de sus reportes |
| **Empleado** | Su propia ficha, sus ausencias/solicitudes, sus documentos y nóminas, su desempeño |

Reglas sensibles: salario e IBAN visibles solo para RRHH/Admin y el propio empleado. Toda acción sobre datos personales o nómina escribe en `AuditLog`.

---

## 6. Definición de Hecho (global) — aplica a TODA funcionalidad

Esto es lo que convierte un botón "de pega" en uno real. Una feature **no está hecha** hasta que:

1. **Persiste.** La acción escribe en la base de datos y el cambio sobrevive a un refresco.
2. **Responde en la UI.** Estado de carga, éxito (toast/feedback) y error gestionado. Optimistic update donde aporte.
3. **Valida.** En cliente (Zod) y en servidor. Mensajes de error claros.
4. **Respeta permisos.** El backend comprueba el rol; la UI oculta/inhabilita lo no permitido.
5. **Audita lo sensible.** Cambios en empleados, nómina y documentos quedan en `AuditLog`.
6. **Tiene test del camino feliz.** Al menos un test (unit o e2e) que demuestra que funciona.
7. **Es accesible.** Foco, labels, navegación por teclado en formularios y diálogos.

---

## 7. Fases

Cada fase es **entregable de forma independiente**. Tras la Fase 1, las Fases 2–4 pueden paralelizarse en sesiones distintas.

### Fase 0 — Fundación
**Objetivo:** esqueleto técnico listo para construir features.
**Alcance:**
- Monorepo, frontend (Vite+React+TS+Tailwind), backend (NestJS) o Supabase, Postgres + Prisma, Docker Compose.
- Portar el **design system "Clear"** a `packages/ui`: tokens (sección 8) + componentes atómicos en `.tsx` (`Button`, `Badge`, `Avatar`, `Card`, `Input`, `Field`, `KPICard`, `PageHeader`, `DeptChip`, `EmpStatus`).
- **Layout shell**: sidebar agrupado (Principal/Tiempo/Talento/Empresa) + área principal con scroll, replicando el prototipo. Routing de todas las secciones.
- **Auth**: registro/login, sesión, RBAC, guard de rutas. Pantalla de login.
- **Seed**: los 17 empleados, departamentos, ausencias y demás datos del prototipo, en la base de datos.
**Criterios de aceptación:** se inicia sesión, se ve el shell con la navegación real y datos del seed servidos desde la API.

### Fase 1 — Personas (Empleados + Organigrama) · *la columna vertebral*
**Objetivo:** CRUD completo de empleados; todo lo demás referencia esto.
**Acciones que funcionan:**
- Listar con búsqueda, filtro por departamento/estado y paginación.
- **Crear** empleado (formulario completo).
- **Editar** empleado ← *el botón que fallaba*. Edición por pestañas (Personal, Puesto, Compensación…).
- Cambiar estado (activo/onboarding/ausente/baja), desactivar/dar de baja.
- Ficha de empleado con sus 7 pestañas leyendo datos reales.
- Organigrama generado desde `managerId` real.
**Datos:** `Employee`, `Department`, `AuditLog`.
**Criterios de aceptación:** crear/editar persiste y se refleja en directorio, ficha y organigrama; permisos aplicados; cambios auditados.

### Fase 2 — Tiempo: Ausencias (+ Calendario)
**Objetivo:** flujo de ausencias de extremo a extremo.
**Acciones que funcionan:**
- **Nueva solicitud** de ausencia ← *fallaba* (con cálculo de días y validación de saldo).
- **Aprobar / Rechazar** desde la cola y desde el panel de Inicio ← *fallaba* (actualiza estado, saldo y notifica).
- Recalcular `LeaveBalance` automáticamente al aprobar/rechazar.
- Calendario de equipo con datos reales (festivos por ubicación incluidos).
- **Exportar** ausencias a CSV/PDF ← *fallaba*.
**Datos:** `Absence`, `LeaveBalance`, `Holiday`, `Notification`, `AuditLog`.
**Criterios de aceptación:** una solicitud creada por un empleado aparece en la cola del manager/RRHH, se aprueba, baja el saldo y se ve en el calendario; export descarga un fichero real.

### Fase 3 — Talento: Onboarding + Desempeño
**Objetivo:** incorporaciones y ciclos de evaluación operativos.
**Acciones que funcionan:**
- **Onboarding:** plantillas de proceso; marcar tareas como hechas (persiste el progreso); asignar manager/buddy; crear proceso al dar de alta a alguien.
- **Desempeño:** crear ciclo; lanzar evaluaciones; completar autoevaluación / evaluación de manager / 1:1; registrar valoración; crear/editar OKRs y actualizar progreso de Key Results.
**Datos:** `OnboardingProcess/Task/Template`, `PerformanceCycle`, `Review`, `Objective`, `KeyResult`.
**Criterios de aceptación:** completar tareas y evaluaciones persiste y mueve los KPIs; los OKRs reflejan el avance real.

### Fase 4 — Empresa: Nómina + Documentos
**Objetivo:** cierre de nómina y gestión documental reales.
**Acciones que funcionan:**
- **Nómina:** generar el cálculo del mes desde los salarios; añadir incidencias (bonus/horas extra/deducciones); **procesar** la nómina (cambia estado); generar PDF de nómina por empleado; **exportar a gestoría** (CSV/SEPA).
- **Documentos:** subir documento; **firmar** los pendientes (vía `SignatureProvider`); usar plantillas; control de versiones; filtro por categoría.
**Datos:** `PayrollRun`, `Payslip`, `PayrollItem`, `Document`, `DocumentSignature`, `DocumentTemplate`, `AuditLog`.
**Criterios de aceptación:** procesar nómina deja registros con su PDF; firmar un documento cambia su estado y queda auditado; el export genera un fichero válido.

### Fase 5 — Informes
**Objetivo:** cuadro de mando analítico (necesita datos de las fases anteriores).
**Alcance:** headcount y evolución, rotación, absentismo, coste de plantilla por área, distribución de desempeño, diversidad. Filtros por periodo/departamento. Export.
**Criterios de aceptación:** cada métrica se calcula desde datos reales y cuadra con los módulos de origen.

### Fase 6 — Reclutamiento (VITAE) integrado
**Objetivo:** desarrollar VITAE como **módulo interno** de Nexo (no app aparte) y cerrar el embudo → plantilla. El modelo de datos ya existe en `schema.prisma` desde la Fase 0; aquí se construye la funcionalidad.
**Acciones que funcionan:** gestión de ofertas (`Job`), candidatos (`Candidate`) y pipeline por etapas (`Stage`/`Application`); entrevistas y evaluaciones; mover candidatos de etapa; cribado automático con traza en `AuditDecision`; **al marcar una `Application` como CONTRATADO, se crea automáticamente el `Employee` (enlazado por `Employee.candidateId`) y arranca su `OnboardingProcess`** (la continuidad que ya se ve en el prototipo, hecha real — Sofía Navarro y Raúl Domínguez son el ejemplo en el seed).
**Reutiliza:** mismo login/RBAC, mismo design system "Clear", misma base de personas. La especificación visual es `docs/mockups/vitae-mockup.html`.
**Datos:** `Job`, `Candidate`, `Stage`, `Application`, `Interview`, `Evaluation`, `AuditDecision` + enlace a `Employee`/`OnboardingProcess`.
**Nota de orden:** depende de Empleados (Fase 1) y Onboarding (Fase 3) para tener a dónde "entregar" al candidato. Si se quiere antes, lo más temprano razonable es justo después de la Fase 3.

### Fase 7 — Fichaje *(la última, requiere hardware)*
**Objetivo:** control horario con integración del hardware de fichaje.
**Alcance:** ingesta de fichajes desde dispositivos, registro de jornada (cumplimiento legal), horas extra, informes de presencia. Definir el protocolo/SDK del hardware antes de empezar.

---

## 8. Design system "Clear" (tokens a portar)

```
Superficies  canvas #F5F6F8 · surface #FFFFFF · subtle #FAFBFC · hover #EDEFF2
Sidebar      slate #DCE2E8 · hover #CCD4DD · borde #D1D5DB
Tinta        primary #0F1419 · secondary #4B5563 · tertiary #9CA3AF · disabled #D1D5DB
Líneas       line #E5E7EB · strong #D1D5DB · subtle #F1F3F5
Acento cian  #1FB6E8 · hover #19A3D0 · pressed #1390BA · soft #E1F4FB · ink #0C6B8A
Estados      success #16A34A/#DCFCE7 · warning #D97706/#FEF3C7 · danger #DC2626/#FEE2E2 · info #2563EB/#DBEAFE
Tipografía   Inter (texto) + JetBrains Mono (datos). Escala 11/12/14/18/22/28/32
Radios       sm 6 · md 8 · lg 12 · xl 16
```
Patrones de layout ya establecidos: KPIs con `grid-rows auto/1fr/auto` (los valores alinean en horizontal), patrón **columna principal + raíl derecho** para dashboards, sidebar de altura completa con scroll solo en el contenido.

---

## 9. Cómo ejecutarlo con Claude Code

1. **Inicializa el repo** con la estructura de la sección 3 y crea `CLAUDE.md` (stack + tokens + modelo de datos + Definición de Hecho).
2. **Adjunta como referencia** `nucleo-rrhh.html` y `vitae-mockup.html` (la spec visual) más este `PLAN.md`.
3. **Una fase = una rama/PR.** Pídele a Claude Code una fase a la vez; dentro de la fase, tarea a tarea con sus criterios de aceptación.
4. **Exige la Definición de Hecho** en cada tarea (que persista + test). Eso evita volver a tener botones que no hacen nada.
5. **Corre los tests** (Vitest + Playwright) antes de cerrar cada PR.

---

## 10. Resumen de fases

| Fase | Módulo | Entrega clave |
|---|---|---|
| 0 | Fundación | Repo, design system, auth, shell, seed |
| 1 | Personas | CRUD empleados + organigrama (Editar funciona) |
| 2 | Ausencias + Calendario | Solicitar/Aprobar/Rechazar/Exportar funcionan |
| 3 | Onboarding + Desempeño | Checklists y evaluaciones reales |
| 4 | Nómina + Documentos | Procesar nómina, firmar, exportar |
| 5 | Informes | Analítica sobre datos reales |
| 6 | Reclutamiento (VITAE) | ATS + embudo→plantilla automático |
| 7 | Fichaje | Integración hardware (al final) |
```
