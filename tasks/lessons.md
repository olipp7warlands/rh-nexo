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
12. **`@nestjs/serve-static` + Express real: dos versiones de `path-to-regexp` conviven y cada
    una exige una sintaxis de comodín distinta.** `exclude` lo evalúa el propio paquete con su
    dependencia de `path-to-regexp` v8 (`'/api/{*splat}'`; `'/api/(.*)'` lanza excepción).
    `renderPath` lo registra Express con SU `path-to-regexp` v0.1.x bundlada (`'*'`; el default
    del paquete, `'{*any}'`, no coincide con nada bajo esa versión y el fallback de SPA nunca se
    dispara, sin ningún error visible). Detalle completo en `tasks/DEPLOY.md` §5.
13. **Fijar `engines.node` en `package.json` cuando el hosting usa Nixpacks/Railpack.** Sin él,
    Railway detectó Node 20 para el build aunque el local es 22 — `@supabase/supabase-js` v2
    instancia un `RealtimeClient` interno (aunque no se use realtime) que exige el `WebSocket`
    nativo de Node 22+, y la API crasheaba en el arranque real sin que los tests ni la
    verificación local lo detectaran (mismo Node en ambos sitios oculta el problema). Poner
    `"engines": {"node": ">=22"}` en el `package.json` raíz (y, por claridad, también en el del
    servicio desplegado) en cuanto se fije una versión mínima de Node para producción.
14. **El aislamiento de tests contra producción tiene que ser estructural, no un recordatorio.**
    Una mitigación manual ("acuérdate de sobreescribir X, Y, Z antes de correr los tests") se
    olvida — pasó de verdad (un test subió un fichero real al bucket de Supabase por no
    sobreescribir `STORAGE_PROVIDER`). Solución de raíz (rama `fix-aislamiento-tests`):
    `.env.test` committeado (valores no sensibles) con su propia BD (`nucleo_test`, mismo
    Postgres local pero base separada de la de `pnpm dev`) y `STORAGE_PROVIDER=""`, cargado en
    DOS puntos — el script `test` de `apps/api/package.json` envuelto con `dotenv-cli`
    (`dotenv -e ../../.env.test -- vitest run`) y `apps/api/test/setup-test-env.ts` como
    `setupFiles` de Vitest (cubre invocar `vitest` directo, saltándose el script) — sin tocar
    `app.module.ts`: como `setupFiles` corre antes de que cualquier spec importe `AppModule`,
    esas claves ya están en `process.env` cuando `ConfigModule` intenta cargar el `.env` real,
    y `dotenv` (por defecto `override:false`) no las pisa. Además, `test-env-guard.ts` verifica
    por LISTA BLANCA (host `localhost`/`127.0.0.1`, `STORAGE_PROVIDER !== 'supabase'`) y aborta
    la suite entera si algo no cuadra — defensa adicional aunque el mecanismo de carga falle.
    Patrón reutilizable para cualquier proyecto con credenciales reales en `.env`. De paso,
    tener una `nucleo_test` separada de `nucleo` (dev) también resuelve la lección #11.
15. **Los specs `*.e2e-spec.ts` corriendo en paralelo (paralelismo de ficheros, default de
    Vitest) compiten por las mismas filas de `Employee`/`PayrollRun` en la BD compartida y
    fallan de forma intermitente (mismo origen que la lección #10, pero visto también en
    `payroll.e2e-spec.ts`: pasa 8/8 en solitario, falla con 404/500 al correr junto a otros
    ficheros).** Sin envolver cada test en una transacción propia (cambio mayor, no hecho),
    la mitigación pragmática es `fileParallelism: false` en `vitest.config.ts` — serializa los
    ficheros, la suite deja de ser flaky a cambio de tardar más en total.
16. **Cuidado con `diff <(git show HEAD:archivo) archivo` cuando el archivo no está trackeado
    en git.** `git show` falla silenciosamente (el archivo no existe en HEAD) y `diff` acaba
    volcando el contenido COMPLETO del archivo real a la salida — si es un `.env` con
    secretos, quedan expuestos en la terminal/transcript aunque el archivo nunca se comitee.
    Pasó de verdad con `DATABASE_URL`/`DIRECT_URL` reales de Supabase. Para comprobar que un
    `.env` no cambió, usar `git status --short .env` (vacío = no trackeado = correcto) o
    `git check-ignore -v .env`, nunca `cat`/`diff` directo sobre el fichero real.
