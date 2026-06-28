# Núcleo — Guía para Claude Code

> Lee este archivo al inicio de cada sesión. Define qué es el producto, cómo está
> montado el repo y las reglas que NO se negocian. Para el detalle por fases, ver `PLAN.md`.

## Qué es Núcleo

Núcleo es el **Core de Recursos Humanos** de un grupo de empresas (estilo Personio/Factorial):
empleados, organigrama, ausencias, fichaje, onboarding, desempeño, nómina, documentos e informes.
**VITAE** es su módulo de reclutamiento (ATS), ya prototipado.

Estamos pasando de **prototipo visual** a **producto funcional**. Los mockups
`nucleo-rrhh.html` y `vitae-mockup.html` (adjuntos al proyecto) son la **especificación visual**:
la fuente de verdad de UI/UX. No hay que rediseñar; hay que **hacer funcionar** lo diseñado.

## Regla de oro — Definición de Hecho

Una funcionalidad **no está terminada** hasta que cumple TODO esto. Es la razón de existir de
este proyecto: el prototipo tenía botones que no hacían nada (Editar, Aprobar, Exportar…).
Eso no puede volver a pasar.

1. **Persiste.** La acción escribe en la base de datos y sobrevive a un refresco.
2. **Responde en la UI.** Estado de carga, éxito (toast/feedback) y error gestionado. Optimistic update donde aporte.
3. **Valida.** En cliente (Zod / RHF) y en servidor (class-validator / DTO). Mensajes claros.
4. **Respeta permisos.** El backend comprueba el rol; la UI oculta/inhabilita lo no permitido.
5. **Audita lo sensible.** Cambios en empleados, nómina y documentos escriben en `AuditLog`.
6. **Tiene test del camino feliz.** Al menos un test (Vitest unit o Playwright e2e).
7. **Es accesible.** Foco, labels, navegación por teclado en formularios y diálogos.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + React Router. Estado servidor con **TanStack Query**. Formularios con **React Hook Form + Zod**.
- **Backend:** **NestJS** (Node + TS). API REST con prefijo `/api`. `ValidationPipe` global (whitelist + transform).
- **ORM / DB:** **Prisma + PostgreSQL**.
- **Auth:** JWT + refresh, **RBAC** por rol (pendiente de implementar en Fase 0).
- **Ficheros:** S3-compatible (MinIO en local vía docker-compose).
- **Firma electrónica:** tras una interfaz `SignatureProvider` (mock en local).
- **Tests:** Vitest (unit) + Playwright (e2e).
- **Monorepo:** pnpm workspaces + Turborepo.

> Alternativa válida para acelerar fases tempranas: Supabase (Postgres+Auth+Storage+RLS). Decisión del equipo.

## Estructura del repo

```
nucleo/
├── apps/
│   ├── web/                # React + Vite (frontend)
│   │   └── src/
│   │       ├── features/   # una carpeta por módulo (employees, absences, …)
│   │       ├── layout/     # AppShell + Sidebar (construir desde src/lib/nav.ts)
│   │       └── lib/        # api.ts (cliente HTTP), nav.ts (navegación)
│   └── api/                # NestJS (backend)
│       └── src/
│           ├── employees/  # módulo de referencia (controller+service+dto)
│           └── prisma/     # PrismaModule global
├── packages/
│   └── ui/                 # Design system "Clear" (componentes + tokens)
│       ├── src/components/  # Button, Badge, Avatar, Card, Input, Field, KPICard, PageHeader, DeptChip, EmpStatus
│       ├── src/styles/globals.css   # variables CSS + helpers + CSS del organigrama
│       └── tailwind-preset.cjs      # paleta "Clear" como colores Tailwind
├── prisma/
│   ├── schema.prisma       # modelo de datos COMPLETO (todas las entidades)
│   └── seed.ts             # datos del prototipo (17 empleados, etc.)
├── docker-compose.yml      # postgres + minio
├── PLAN.md                 # roadmap por fases
└── CLAUDE.md               # este archivo
```

## Scripts

```bash
pnpm install                # instala todo el workspace
docker compose up -d        # postgres + minio
pnpm db:migrate             # aplica migraciones (genera la primera)
pnpm db:seed                # carga los datos del prototipo
pnpm dev                    # arranca web (5173) + api (3000) en paralelo
pnpm db:studio              # Prisma Studio
pnpm db:reset               # resetea la BD y vuelve a sembrar
```

## Diseño — sistema "Clear"

Usa SIEMPRE los componentes de `@nucleo/ui` y los tokens. No inventes estilos sueltos.
Importa la hoja global una vez: `import '@nucleo/ui/styles.css'`.

```
Superficies  canvas #F5F6F8 · surface #FFFFFF · subtle #FAFBFC · hover #EDEFF2
Sidebar      slate #DCE2E8 · hover #CCD4DD
Tinta        primary #0F1419 · secondary #4B5563 · tertiary #9CA3AF · disabled #D1D5DB
Líneas       #E5E7EB / strong #D1D5DB / subtle #F1F3F5
Acento cian  #1FB6E8 · hover #19A3D0 · pressed #1390BA · soft #E1F4FB · ink #0C6B8A
Estados      success #16A34A/#DCFCE7 · warning #D97706/#FEF3C7 · danger #DC2626/#FEE2E2 · info #2563EB/#DBEAFE
Tipografía   Inter (texto) + JetBrains Mono (datos numéricos → clase .mono)
Radios       sm 6 · md 8 · lg 12 · xl 16
```
Patrones: KPIs con `.stat-card` (valores alineados), dashboards en **columna principal + raíl derecho**,
sidebar de altura completa con scroll solo en el contenido, organigrama con el CSS de `globals.css`.

## Modelo de datos (resumen)

Definido al completo en `prisma/schema.prisma`. Dominios:

- **Identidad/Org:** `User` (auth, rol), `Employee` (ficha completa, auto-relación manager/reports), `Department` (con lead).
- **Tiempo:** `Absence`, `LeaveBalance`, `Holiday`, `TimeEntry` (fichaje, Fase 7).
- **Talento:** `OnboardingTemplate/TemplateTask`, `OnboardingProcess/Task`, `PerformanceCycle`, `Review`, `Objective`, `KeyResult`.
- **Reclutamiento (VITAE, módulo interno):** `Job`, `Candidate`, `Stage`, `Application`, `Interview`, `Evaluation`, `AuditDecision`. El candidato contratado se enlaza a su ficha con `Employee.candidateId`. Al pasar una `Application` a CONTRATADO se crea el `Employee` y su onboarding (Fase 6).
- **Empresa:** `PayrollRun`, `Payslip`, `PayrollItem`, `Document`, `DocumentSignature`, `DocumentTemplate`.
- **Transversal:** `AuditLog`, `Notification`.

Dinero en euros como `Int`. Si se necesita precisión contable, migrar campos monetarios a `Decimal`.

## Roles y permisos (RBAC)

| Rol | Alcance |
|---|---|
| **ADMIN** | Todo + configuración del sistema |
| **RRHH** | Todos los empleados, ausencias, nómina, documentos, desempeño, reclutamiento |
| **MANAGER** | Su equipo: ver fichas, aprobar ausencias, evaluar, ver onboarding de sus reportes |
| **EMPLEADO** | Su ficha, sus ausencias/solicitudes, sus documentos y nóminas, su desempeño |

Salario e IBAN: solo RRHH/ADMIN y el propio empleado. Toda acción sobre datos personales o nómina → `AuditLog`.

## Qué hay ya hecho (scaffolding) y qué falta

**Hecho** (úsalo como base, no lo rehagas desde cero):
- Modelo de datos completo (`schema.prisma`) + seed con los datos del prototipo.
- Design system "Clear" portado a `@nucleo/ui` (10 componentes + tokens + globals).
- **Vertical slice de referencia de Empleados**, que demuestra la Definición de Hecho end-to-end:
  - API: `apps/api/src/employees/*` → `update()` persiste y escribe en `AuditLog` (esto es "Editar funciona").
  - Web: `apps/web/src/features/employees/*` → `useUpdateEmployee` (mutación + invalidación de caché) y `EmpleadosPage` (lista real desde la API con los componentes Clear).
- Config del monorepo (pnpm, turbo, tsconfig, docker-compose, .env.example).

**Falta** (construir por fases, ver `PLAN.md`):
- Fase 0: auth + RBAC + guards, `AppShell` con `Sidebar` (desde `src/lib/nav.ts`), pantalla de login.
- Fase 1: completar Empleados (ficha de 7 pestañas, modal de Editar con `useUpdateEmployee`, alta) + Organigrama.
- Fases 2–7: Ausencias, Onboarding+Desempeño, Nómina+Documentos, Informes, VITAE, y Fichaje (último, requiere hardware).

## Cómo trabajar

- **Una fase = una rama/PR.** Dentro de la fase, tarea a tarea con sus criterios de aceptación (ver `PLAN.md`).
- **Replica el patrón del slice de Empleados** para cada nuevo módulo: módulo NestJS (controller+service+dto con validación + audit) ↔ feature en web (hooks de TanStack Query + páginas con `@nucleo/ui`).
- **El mockup manda en lo visual.** Ante una duda de UI, mira `nucleo-rrhh.html`.
- **No cierres una tarea sin la Definición de Hecho** (persiste + test). Es el objetivo del proyecto.
- Cada acción sensible escribe en `AuditLog` con `action`, `entity`, `entityId`, `before`, `after`.

## Cuentas de prueba (tras el seed)

Contraseña para todas: `nucleo123`
- `admin@grupo.com` — ADMIN
- `blanca.ruiz@grupo.com` — RRHH
- `carlos.soto@grupo.com` — MANAGER
- `diego.ortega@grupo.com` — EMPLEADO
