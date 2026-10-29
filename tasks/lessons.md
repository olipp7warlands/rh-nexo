# Lecciones — Nexo

> Patrones aprendidos para no repetir errores. Revisar al inicio de cada sesión.
> Máx. 20 activas; purgar las ya incorporadas al código/config.

## Prisma
1. **Prisma, tres trampas de arranque.** (a) Enums en multilínea, un valor por línea: `enum X { A B C }`
   en una línea da un error confuso que apunta a líneas equivocadas. (b) `prisma generate` desde
   la raíz necesita `@prisma/client` declarado en la raíz (dueña de `schema.prisma` y del seed),
   si no intenta auto-instalarlo y falla. (c) `migrate dev` auto-siembra: usar `--skip-seed` para
   controlar el seed aparte. (Antes #1-#3; fusionadas, la numeración se mantiene.)

## Monorepo / TypeScript (pnpm)
4. **Cada paquete declara los tipos que consume.** Con el aislamiento de pnpm, `packages/ui` no
   "ve" los `@types/react` de `apps/web`. Un paquete que importa React debe tener `@types/react`
   (+ `@types/react-dom`) en sus propias `devDependencies`, o `tsc` falla con
   "Could not find a declaration file for module 'react'".
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
8. **Vitest + NestJS: glob y SWC.** `*.spec.ts` NO casa con `auth.e2e-spec.ts` (es `-spec.ts`): usar
   `*spec.ts` en `include`. Y la DI/class-validator necesitan metadata de decoradores: `unplugin-swc`
   en `vitest.config.ts` (esbuild solo no la emite). (Antes #8-#9.)
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
    Y el `AuditLog` NO se borra jamás (regla del producto; el clasificador de permisos también lo bloquea):
    una cuenta/persona de prueba que ya generó auditoría no se puede eliminar (FK del actor) — se deja
    DESACTIVADA y se nombra como dato de prueba; solo los tests contra `nucleo_test` limpian su propia auditoría.
12. **`@nestjs/serve-static` + Express real: dos versiones de `path-to-regexp` conviven y cada
    una exige una sintaxis de comodín distinta.** `exclude` lo evalúa el propio paquete con su
    dependencia de `path-to-regexp` v8 (`'/api/{*splat}'`; `'/api/(.*)'` lanza excepción).
    `renderPath` lo registra Express con SU `path-to-regexp` v0.1.x bundlada (`'*'`; el default
    del paquete, `'{*any}'`, no coincide con nada bajo esa versión y el fallback de SPA nunca se
    dispara, sin ningún error visible). Detalle completo en `tasks/DEPLOY.md` §5.
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
    Corolario (antes #16): para comprobar que un `.env` no cambió, nunca `cat`/`diff` sobre el fichero real
    (si no está trackeado, `diff <(git show …)` vuelca los secretos al transcript); usar `git status --short .env`.
15. **Los specs `*.e2e-spec.ts` corriendo en paralelo (paralelismo de ficheros, default de
    Vitest) compiten por las mismas filas de `Employee`/`PayrollRun` en la BD compartida y
    fallan de forma intermitente (mismo origen que la lección #10, pero visto también en
    `payroll.e2e-spec.ts`: pasa 8/8 en solitario, falla con 404/500 al correr junto a otros
    ficheros).** Sin envolver cada test en una transacción propia (cambio mayor, no hecho),
    la mitigación pragmática es `fileParallelism: false` en `vitest.config.ts` — serializa los
    ficheros, la suite deja de ser flaky a cambio de tardar más en total.
17. **Arranque local: Turborepo (modo `strict`, default desde Turbo 2.x) NO propaga las variables de entorno
    del proceso padre a las tareas hijas.** `dotenv -e .env.local -- turbo run dev` puede
    arrancar la API contra el `.env` real (producción) EN SILENCIO — Nest cae a su propio
    fallback de `ConfigModule` sin ningún error visible hasta que una query falla con "table
    does not exist". Pasó de verdad (ver incidente de producción documentado en el historial).
    Arreglo: `--env-mode=loose` en la invocación de turbo cuando se quiere que herede el env
    del padre. Además, nunca fiarse solo del wrapper: `apps/api/src/main.ts` tiene una guarda
    en el propio proceso (`assertNotAccidentalProduction`, independiente de cómo se arrancó)
    que aborta si `DATABASE_URL` es de producción y `NODE_ENV !== 'production'`.
    Mismo origen (arranque local que apunta a lo equivocado): tampoco asumir puertos fijos — otro
    proyecto de la máquina puede ocupar el 3000 (`EADDRINUSE`) y el proxy de Vite sigue reenviando
    en silencio al servidor equivocado (404 sin pista). `vite.config.ts` lee `PORT` del entorno
    (`.env.local` usa 3001); ante un fallo «en dev», mirar primero `Get-NetTCPConnection -State Listen`.
    (Antigua lección #18, fusionada aquí; la numeración del resto no cambia.)
19. **`pnpm db:seed` NUNCA se ejecuta contra producción — la excepción del 2026-07-21 fue
    puntual y no sienta precedente.** `prisma/seed.ts` hace `deleteMany()` de todas las tablas
    de negocio antes de reinsertar; es un reset completo, no un upsert idempotente. El
    2026-07-21 se sembró la producción real de humanX (`qkeadkgdzwzsvjvfczhv`) tras verificar
    explícitamente por consulta directa (recuentos, nombres/emails de empleados, fechas
    `createdAt`, bucket de Storage) que la base **solo contenía datos del seed inicial sin
    ninguna edición ni actividad real desde el despliegue** — cero riesgo de borrar algo de
    valor. Backup físico confirmado (Supabase, <24h) antes de tocar nada. Esto NO cambia la
    regla permanente: en cuanto producción tenga una sola persona, ausencia, documento o
    nómina reales, sembrar (o cualquier operación que borre y reinserte) queda terminantemente
    prohibido sin excepción. Antes de repetir algo parecido, volver a verificar desde cero que
    sigue sin haber datos reales; no asumir que la conclusión de esta fecha sigue vigente.

## RLS / Supabase
20. **Prisma NO activa RLS en las tablas que crea — cada migración nueva nace expuesta hasta que
    alguien lo hace a mano.** El 2026-09-09 el linter de Supabase detectó 7 tablas sin RLS en
    las tres bases (dev, test y producción): `Idioma`, `TipoContrato`, `Jornada`, `Proyecto`,
    `RelacionEmergencia`, la tabla de unión implícita `_EmployeeToIdioma` y `_prisma_migrations`.
    Todas eran tablas creadas en migraciones posteriores a la pasada de RLS de la auditoría de
    seguridad, así que quedaron accesibles en lectura, escritura y borrado vía la API PostgREST
    de Supabase con la `anon key`. Corregido a mano con `ALTER TABLE ... ENABLE ROW LEVEL
    SECURITY` en los tres proyectos. Arreglo de raíz: cada migración de Prisma que cree tablas
    debe editar el `migration.sql` generado para añadir esa sentencia por cada tabla nueva
    (incluidas las de unión implícita `_AToB`), y tras cada despliegue con migración hay que
    revisar el Security Advisor de Supabase y confirmar cero errores `rls_disabled_in_public`.
    Ver regla 8 de la Definición de Hecho en `CLAUDE.md`.
21. **Supabase free borra los proyectos pausados (~90 días): el de dev hubo que recrearlo el
    2026-10-15.** El proyecto `dfwwslptvumtmqrlehek` desapareció por inactividad y la API dejó de
    arrancar (`tenant/user not found`). Nuevo dev: `bpoqmytzrymxxsfjiraz`. Procedimiento para
    repetirlo: (1) crear el proyecto en Supabase; (2) pegar en `.env.local` DATABASE_URL = pooler
    de transacción `:6543/postgres?pgbouncer=true&connection_limit=10` y DIRECT_URL = pooler de
    sesión `:5432`, ambos con usuario `postgres.<ref>` (NO el host directo `db.<ref>.supabase.co`:
    es solo IPv6 y no conecta desde aquí; y no cruzar las dos URLs: `migrate` a través del pooler
    de transacción se cuelga); (3) actualizar `DEV_REF` en `scripts/assert-dev-env.js`, o la guarda
    aborta; (4) `prisma migrate deploy` con el env de `.env.local`; (5) `pnpm db:dev:seed`;
    (6) `scripts/enable-rls-all.sql` (activa RLS en todas las tablas de public, dinámico; Prisma
    no lo hace, ver #20) y comprobar que todas tienen `relrowsecurity = true`. Antes de dar por
    perdido dev, mirar el panel: pausado ≠ borrado. (La lección #5, `*.tsbuildinfo`, se purgó:
    ya está en `.gitignore`; la numeración se mantiene porque hay referencias a #14, #19 y #20.)

## Operaciones sobre producción
22. **Tras cada compactación de sesión, re-verificar contra la base antes de afirmar nada.** El
    2026-10-28 la compactación me hizo perder un hecho verificado (la migración
    `20261015121114` SÍ estaba aplicada en producción desde el 17-oct) y llegué a darla por
    pendiente en un informe. Regla: antes de afirmar el estado de migraciones, datos o cuentas,
    consultarlo en vivo (`_prisma_migrations`, `information_schema`, conteos); el resumen de la
    sesión no es una fuente.
    Vale igual para las premisas del enunciado: el 2026-10-29 se dio por «mergeado» el PR #11 y seguía
    abierto (`gh pr view` lo mostró antes de ramificar). Ante «ya está mergeado/aplicado/desplegado»,
    comprobarlo en vivo y, si no cuadra, avisar y apilar/adaptar en vez de actuar sobre la suposición.
23. **backup verificado → commit, en ese orden y nombrando el backup.** El 2026-10-28 el
    `commit=true` de la limpieza de producción se ejecutó antes del backup programado acordado
    (confirmé con un backup descrito como «de esta noche», sin comprobar yo que fuera el programado).
    Sin consecuencias, pero el orden no es negociable: la confirmación de cualquier
    operación destructiva debe nombrar el backup concreto (fecha/origen) y yo lo cito de vuelta
    antes de ejecutar, en vez de dar por buena una descripción genérica.
    Matiz (2026-10-29): se aceptó un backup de las 06:21Z, anterior a la migración de las 13:14Z. Vale para
    una migración ADITIVA, pero un restore obligaría a reaplicar la anterior y perdería lo escrito después:
    al pedir/citar el backup, comprobar que sea posterior a la última migración aplicada y decirlo.
24. **Contraseñas: nunca por línea de comandos ni por el chat; solo entrada interactiva o variable
    de entorno tecleada por la persona.** Un argumento queda en el historial y la shell lo
    escapa; el chat las conserva. El 2026-10-28 creé `oliver.perez@wowinx.com` con una
    contraseña dada en el chat (vía `ADMIN_PASSWORD` en la propia orden) y hubo que resetearla.
    El diagnóstico demostró que el hash sí coincidía (el fallo estaba en lo tecleado en el
    login, no en el escapado), pero la regla sigue: `scripts/create-admin-user.mjs` lee
    `ADMIN_PASSWORD` o prompt enmascarado; la persona lo ejecuta en su terminal.
25. **El ciclo es migración → merge, nunca al revés.** El 2026-10-28 la Tanda 1 de Selección II se
    ejecutó invertida: PR #5 mergeado a las 21:09Z y `migrate deploy` en producción a las 21:18Z,
    sin backup nombrado (incumple #23). Hubo ~9 min de código sin esquema en producción. Regla:
    el merge a `master` (que despliega) solo ocurre DESPUÉS de verificar en `_prisma_migrations`
    de producción que la migración está aplicada; y el backup se nombra antes del `migrate deploy`.
    **Repetido el 2026-10-29 (PR #6, Feedback RRHH):** el merge se hizo a las 13:13:10Z y la migración
    terminó a las 13:14:50Z, ~100 s de código sin esquema; salió bien solo por ser aditiva (columnas
    nullables). Tercer ciclo invertido: al reportar «migración lista», recordar el orden y esperar
    confirmación de que `_prisma_migrations` está al día ANTES de que se mergee.
26. **Un `DELETE` expuesto debe revisar los `onDelete` de TODAS las relaciones, no solo contar personas.** Los
    catálogos solo bloqueaban si había empleados; pero `Holiday.localizacion` es `Cascade` (borrar una
    localización se llevaba sus festivos) y `Job.sociedad/proyecto/department` son `SetNull` (borrar
    desvinculaba ofertas en silencio). Antes de poner un botón/menú de borrar: listar las relaciones
    entrantes del modelo, bloquear con 409 + conteos por tipo (`lib/delete-blockers.ts`), devolver esos
    conteos en el listado para deshabilitar la acción con su motivo y testear que NO se toca nada.
27. **Para invalidar tokens tras un cambio de credenciales, versionar el claim; no comparar el `iat`.** El `iat`
    de un JWT va en segundos: un token emitido en el mismo segundo que el cambio de contraseña sobrevivía y
    el test del restablecimiento fallaba de forma intermitente solo en la suite completa. Solución en
    `AuthService.issueTokens`/`JwtStrategy`: claim `pwv` = `passwordChangedAt` en ms, comparado por igualdad.
    Regla general: ante un flaky que depende de la resolución temporal, arreglar el diseño, no meter esperas.
