# Lecciones — Nexo

> Patrones aprendidos para no repetir errores. Revisar al inicio de cada sesión.
> Máx. 20 activas; purgar las ya incorporadas al código/config.

## Prisma
1. **Enums en multilínea, siempre.** Prisma NO admite `enum X { A B C }` en una sola línea
   (error confuso "This line is not an enum value definition" que apunta a líneas equivocadas
   en cascada). Un valor por línea.
2. **`prisma generate` desde la raíz necesita `@prisma/client` en la raíz.** El paquete dueño de
   `prisma/schema.prisma` y del script de seed (aquí, la raíz del monorepo) debe declarar
   `@prisma/client`, no solo `apps/api`. Si no, `generate` intenta auto-instalarlo y falla.
3. **`migrate dev` auto-siembra.** Usar `--skip-seed` cuando se quiera controlar el seed aparte
   y evitar dobles inserciones / errores de unicidad.

## Monorepo / TypeScript (pnpm)
4. **Cada paquete declara los tipos que consume.** Con el aislamiento de pnpm, `packages/ui` no
   "ve" los `@types/react` de `apps/web`. Un paquete que importa React debe tener `@types/react`
   (+ `@types/react-dom`) en sus propias `devDependencies`, o `tsc` falla con
   "Could not find a declaration file for module 'react'".
5. **Artefactos fuera de git.** Añadir `*.tsbuildinfo` al `.gitignore` (lo genera `tsc -b`).

## React / Formularios
6. **Inputs reutilizables con `forwardRef`.** Para integrarse con React Hook Form (`register()`),
   los componentes de input del design system deben reenviar `ref` al `<input>` real.

## RBAC en frontend
7. **No dispares una query sin permiso solo porque el componente se montó.** Un rol sin acceso
   (p. ej. EMPLEADO en un módulo de RRHH/MANAGER) monta la página igual que cualquiera; si el
   hook de TanStack Query no recibe un `enabled` condicionado al rol, el 403 llega en silencio
   y la UI se queda vacía sin explicar por qué (viola el punto 4 de la Definición de Hecho).
   Patrón ya establecido en `InformesPage.tsx` (Fase 5): comprobar el rol ANTES del `return`,
   mostrar una tarjeta explicando el porqué, y pasar `enabled: canView` a los hooks para que ni
   siquiera se dispare la petición. Replicarlo en cualquier página nueva restringida por rol.

## Verificación
8. **El patrón glob de Vitest importa.** `*.spec.ts` NO casa con `auth.e2e-spec.ts` (es `-spec.ts`).
   Usar `*spec.ts` en `include` para aceptar ambas convenciones.
9. **NestJS bajo Vitest requiere SWC.** La DI y class-validator dependen de la metadata de
   decoradores; usar `unplugin-swc` en `vitest.config.ts` (esbuild solo no la emite).
10. **Nunca comparar contra un `count()` en vivo entre specs.** Todos los ficheros
    `*.e2e-spec.ts` corren en paralelo contra el mismo Postgres; `employees.e2e-spec.ts` crea y
    borra un empleado de prueba durante su ejecución, así que cualquier otro test que haga
    `db.employee.count()` en un momento arbitrario puede leer ±1 de más. Comprobar en su lugar
    invariantes estables (ids conocidos del seed, `sumDept === totalActive` con datos de la misma
    respuesta) en vez de un número exacto recalculado aparte. Pendiente (fuera de alcance de Fase
    4): `ReportsService.overview()` lanza 11 queries independientes vía `Promise.all` sin
    transacción, así que además de la comparación de test, el propio dato puede ser
    internamente inconsistente si la mutación cae entre dos de esas queries — se manifiesta como
    flakiness ocasional en `reports.e2e-spec.ts`; arreglarlo de raíz requeriría envolver esas
    queries en una transacción de Prisma.
11. **La verificación manual (`pnpm dev`) escribe en la misma BD que los tests e2e.** Crear una
    oferta, un candidato o procesar una nómina a mano mientras se prueba en el navegador deja
    registros reales que luego chocan con los tests (p. ej. "ya existe una nómina para ese
    periodo" en `payroll.e2e-spec.ts`, o infla los conteos de empleados). Tras cualquier sesión
    de verificación manual, limpiar explícitamente lo creado antes de volver a correr
    `pnpm --filter @nucleo/api test`.
12. **Con `.env` apuntando a Supabase real, correr tests locales sin sobreescribir
    `DATABASE_URL`/`DIRECT_URL`/`STORAGE_PROVIDER` ejecuta contra producción.** Pasó de verdad:
    un test de subida de documentos escribió un fichero real en el bucket de Supabase porque
    solo se sobreescribió la BD, no `STORAGE_PROVIDER`. Sobreescribir SIEMPRE las tres juntas
    inline al correr tests si el `.env` tiene credenciales reales (ver `tasks/DEPLOY.md` §3).
13. **`@nestjs/serve-static` + Express real: dos versiones de `path-to-regexp` conviven y cada
    una exige una sintaxis de comodín distinta.** `exclude` lo evalúa el propio paquete con su
    dependencia de `path-to-regexp` v8 (`'/api/{*splat}'`; `'/api/(.*)'` lanza excepción).
    `renderPath` lo registra Express con SU `path-to-regexp` v0.1.x bundlada (`'*'`; el default
    del paquete, `'{*any}'`, no coincide con nada bajo esa versión y el fallback de SPA nunca se
    dispara, sin ningún error visible). Detalle completo en `tasks/DEPLOY.md` §5.
