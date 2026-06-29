# Fase 0 — Fundación (rama `fase-0-fundacion`)

> Objetivo (PLAN.md §7): se inicia sesión → se ve el shell con navegación real →
> los datos del seed se sirven desde la API. Respetar la Definición de Hecho.

## Decisiones acordadas
- [x] `schema.prisma`/`seed.ts`: la raíz (con VITAE) sobrescribe `prisma/`; copias de raíz eliminadas.
- [x] Rename a **Nexo** en nombre visible: login + sidebar, `<title>` de index.html, README, encabezados/intros de CLAUDE.md y PLAN.md. Intactos: `@nucleo/*`, rutas, DB `nucleo`, `nucleo123`, mockups.
- [x] Rama `fase-0-fundacion` desde `master`.

## Bloque A — Infra y datos  ✅ COMPLETADO
- [x] A1. `pnpm install`
- [x] A2. `docker compose up -d` (Postgres + MinIO) — contenedores `Started`
- [x] A3. `.env.example` → `.env`
- [x] A4. Migración inicial Prisma `20260628195555_init` aplicada
      - Fix: enums reformateados a multilínea (Prisma no admite enum en 1 línea)
      - Fix: `@prisma/client` añadido a la raíz (dueña del schema/seed)
- [x] A5. `pnpm db:seed` → 17 empleados, 8 deptos, nómina 2026-06, 5 ofertas + pipeline VITAE

## Bloque B — Backend Auth + RBAC  ✅ COMPLETADO (9/9 casos verificados con curl)
- [x] B1. Deps auth: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@nestjs/config`
- [x] B2. `AuthModule`: login (bcrypt) → access+refresh; `/api/auth/refresh`; `/api/auth/me`
- [x] B3. `JwtAuthGuard` global (+ `@Public()`) + `@Roles()` + `RolesGuard`
- [x] B4. `EmployeesController` con `@Roles('ADMIN','RRHH')` en mutaciones + actor del JWT en audit; salario/IBAN enmascarado salvo ADMIN/RRHH o ficha propia

## Bloque C — Frontend Shell + Auth  ✅ COMPLETADO (tsc + vite build OK; login y datos verificados vía proxy)
- [x] C1. Deps: `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`; `api.ts` con Bearer + refresh automático en 401
- [x] C2. `AppShell` + `Sidebar` desde `nav.ts` (iconos lucide, estado activo, tag VITAE, "soon", usuario+logout) replicando el mockup
- [x] C3. Login (RHF+Zod, accesible) + `AuthContext` (hidrata con /auth/me) + `ProtectedRoute`
- [x] C4. Rutas de todas las secciones generadas desde `nav.ts` (placeholders salvo Empleados)
      - Fix scaffolding: `@nucleo/ui` ahora declara `@types/react`/`@types/react-dom` (sin ello el build de web fallaba)
      - Mejora: `Input` de `@nucleo/ui` pasa a `forwardRef` (necesario para RHF)

## Bloque D — Cierre (Definición de Hecho)  ✅ COMPLETADO
- [x] D1. Test camino feliz: Vitest + supertest (app Nest en memoria) → `test/auth.e2e-spec.ts`, 5/5 verde
      (401 sin token · login pass-incorrecta 401 · login ADMIN→/me→empleados con salario · EMPLEADO enmascarado + 403 · refresh)
- [x] D2. AC Fase 0 verificada: login funciona, shell con navegación real desde nav.ts, datos del seed servidos por la API

## Cuentas de prueba (tras seed) — pass `nucleo123`
admin@grupo.com (ADMIN) · blanca.ruiz@grupo.com (RRHH) · carlos.soto@grupo.com (MANAGER) · diego.ortega@grupo.com (EMPLEADO)

## Revisión

**Fase 0 (Fundación) completada** en la rama `fase-0-fundacion`. Criterio de aceptación cumplido:
se inicia sesión, se ve el AppShell con la navegación real (desde `nav.ts`) y los datos del seed
se sirven desde la API protegida por JWT.

**Backend**: `AuthModule` (login bcrypt + JWT access/refresh, `/auth/me`), `JwtAuthGuard` global con
`@Public()`, `RolesGuard` con `@Roles()`, `EmployeesController` con mutaciones restringidas a ADMIN/RRHH,
actor del JWT en `AuditLog`, y salario/IBAN enmascarado salvo ADMIN/RRHH o ficha propia.

**Frontend**: cliente HTTP con Bearer + refresh automático en 401, `AuthProvider`/`useAuth`,
`ProtectedRoute`, `LoginPage` (RHF+Zod, accesible), `AppShell`+`Sidebar` (desde `nav.ts`, fiel al mockup),
rutas de todas las secciones (placeholders salvo Empleados).

**Fixes de scaffolding necesarios** (el starter nunca se había migrado ni compilado del todo):
- Enums de `schema.prisma` reformateados a multilínea (Prisma no admite enum en una línea).
- `@prisma/client` añadido a la raíz (dueña de schema/seed).
- `@nucleo/ui` declara ahora `@types/react`/`@types/react-dom`; `Input` pasa a `forwardRef` (RHF).

**Verificación**: `apps/api` build OK · `apps/web` `tsc`+`vite build` OK · 5/5 tests de integración verde ·
flujo login+datos comprobado vía proxy del navegador (`:5173/api`).

### Pendiente / siguiente
- Confirmar **commit** de la Fase 0 (a la espera del visto bueno del usuario).
- Lecciones para `tasks/lessons.md` (enum Prisma multilínea, @types en paquetes de workspace, forwardRef para RHF).
- **Fase 1 (Personas)**: ficha de 7 pestañas, modal Editar con `useUpdateEmployee`, alta, organigrama.
