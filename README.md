# Núcleo

Core de Recursos Humanos del grupo (estilo Personio/Factorial), con **VITAE** como módulo de
reclutamiento. Monorepo con frontend React + backend NestJS + PostgreSQL.

> **Para Claude Code:** empieza leyendo [`CLAUDE.md`](./CLAUDE.md) y el roadmap en [`PLAN.md`](./PLAN.md).
> La especificación visual son los mockups `nucleo-rrhh.html` y `vitae-mockup.html`.

## Requisitos

- Node 20+ y **pnpm 9+** (`npm i -g pnpm`)
- Docker (para Postgres y MinIO en local)

## Arranque

```bash
# 1) Dependencias (descarga los engines de Prisma en este paso)
pnpm install

# 2) Infraestructura local (Postgres + MinIO)
docker compose up -d

# 3) Variables de entorno
cp .env.example .env        # ajusta si hace falta

# 4) Base de datos: primera migración + datos del prototipo
pnpm db:migrate             # crea la migración inicial a partir de schema.prisma
pnpm db:seed                # carga 17 empleados, ausencias, nómina, etc.

# 5) Levantar todo (web :5173 + api :3000)
pnpm dev
```

Web en http://localhost:5173 · API en http://localhost:3000/api · Prisma Studio con `pnpm db:studio`.

## Cuentas de prueba

Contraseña: `nucleo123` — `admin@grupo.com` (ADMIN), `blanca.ruiz@grupo.com` (RRHH),
`carlos.soto@grupo.com` (MANAGER), `diego.ortega@grupo.com` (EMPLEADO).

## Estructura

```
apps/web      Frontend React + Vite + Tailwind
apps/api      Backend NestJS + Prisma
packages/ui   Design system "Clear" (componentes + tokens)
prisma        schema.prisma (modelo completo) + seed.ts
```

## Estado

Starter kit con el **modelo de datos completo**, el **design system** portado y una **vertical
slice de referencia de Empleados** (API + frontend) que ya cumple la Definición de Hecho:
editar un empleado **persiste** en la BD y queda **auditado**.

El resto de secciones se construyen por fases siguiendo [`PLAN.md`](./PLAN.md), replicando el patrón
del slice de Empleados. La regla innegociable está en `CLAUDE.md`: ninguna acción se da por hecha
hasta que persiste, valida, respeta permisos y tiene test. (Es lo que faltaba en el prototipo.)

## Notas

- `pnpm db:migrate` descarga los engines de Prisma; necesita red la primera vez.
- Fichaje (`TimeEntry`) es la **última** fase: requiere integración con el hardware de fichaje.
- Dinero en euros como `Int`; migrar a `Decimal` si se requiere precisión contable.
