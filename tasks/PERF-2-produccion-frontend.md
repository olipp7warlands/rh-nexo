# TAREA 2 — Rendimiento en producción y frontend: estado y medidas

> La pasada anterior (`tasks/lessons.md`, commit de rendimiento en `auditoria-seguridad`) solo
> midió backend en dev, con curl uno a uno — nunca reprodujo carga concurrente real ni el salto
> de red hasta producción. Esta pasada corrige eso: mide contra
> `https://nucleoapi-production.up.railway.app` con tráfico real de navegador.

## Hallazgos y su estado

| # | Hallazgo | Estado | Rama |
|---|---|---|---|
| 1 | Railway en `us-east4` (Virginia) vs Supabase producción en `eu-west-3` (París) — latencia transatlántica en cada round-trip a BD | ✅ Resuelto — usuario movió el servicio a `europe-west4-drams3a` (Ámsterdam) desde el dashboard | — |
| 2 | `connection_limit=1` serializaba las queries concurrentes de una misma pantalla | ✅ Resuelto | `perf-2` (+ variable `DATABASE_URL` de Railway actualizada directamente en producción) |
| 3 | Cero code-splitting por ruta (bundle único de 508 KB) | ✅ Resuelto | `perf-2` |
| 4 | `/auth/me` bloqueaba en serie el resto de peticiones de cualquier pantalla | ✅ Resuelto | `perf-2` |
| 5 | Cold start | ⚪ Descartado — `sleepApplication: false` confirmado, el servicio no duerme | — |

## Medidas — antes / después

### #2 — `connection_limit` (1 → 10)
5 peticiones del dashboard disparadas en paralelo real (`curl --parallel`, o el navegador):

| | Antes (`connection_limit=1`) | Después (`connection_limit=10`) |
|---|---|---|
| Patrón | Escalera: cada petición termina más tarde que la anterior | Todas terminan en una franja estrecha |
| Rango de finalización | 1.58s → 3.22s (peor caso: 3.22s) | 0.61s → 0.69s (peor caso: 0.69s) |

`max_connections` de Postgres = 60 (tier actual), 13 en uso por los propios servicios de
Supabase — `connection_limit=10` deja margen amplio. **Revisar de nuevo si se cambia de plan
de Supabase.**

### #3 — Code-splitting
Build de producción (`pnpm --filter @nucleo/web build`):

| | Antes | Después |
|---|---|---|
| Bundle inicial (JS) | 508 KB (gzip 136.9 KB), un único chunk con las 15 páginas | 328.6 KB (gzip 100.8 KB) — **-35%** |
| Resto de páginas | Incluidas en el bundle inicial | 15 chunks propios (0.3 KB–24 KB), descargados solo al visitar esa ruta |
| Aviso de Vite ("chunk > 500 KB") | Sí, en cada build | Desaparece |

Verificado en navegador real (Playwright/claude-in-chrome) contra `humanx-dev`: navegación
entre Inicio → Nómina carga el chunk bajo demanda sin errores de consola, con un fallback
"Cargando…" (`<Suspense>`) mientras llega.

### #4 — `/auth/me` bloqueando el resto de peticiones
Trazas de `performance.getEntriesByType('resource')` en el navegador, cargando el dashboard
tras iniciar sesión:

| | Antes | Después |
|---|---|---|
| `/auth/me` | 468ms → 1038ms | 557ms → 811ms (similar en duración) |
| Resto de peticiones (kpis, sociedades, países, agenda, anotaciones) | No arrancan hasta 1057ms (**después** de que `/auth/me` termine) | Arrancan a 639-642ms (**en paralelo** con `/auth/me`, sin esperar) |
| Coste fijo añadido a cada carga de página | ~570-600ms de cola | ~0ms |

**Cómo**: la sesión ahora se pinta de forma optimista decodificando el payload del access
token en el cliente (sin red) — `AuthContext` ya no tiene un estado `loading` que bloquee
`ProtectedRoute`. `/auth/me` se sigue llamando en paralelo para confirmar la sesión y añadir
`employee.{fullName,jobTitle}` (que no viaja en el JWT), y para cerrar sesión si el token ya
no es válido — pero ya no bloquea nada. Aplica tanto al login como a recargar la página con
sesión ya guardada.

### #5 — Informes (efecto combinado de #1+#2)
| | Antes (`connection_limit=1`, `us-east4`) | Tras `connection_limit=10` (aún en `us-east4`) | Tras mover a `eu-west4` |
|---|---|---|---|
| 3 medidas | 2.37s / 2.41s / 2.43s | 2.41s / 2.42s / 2.47s — sin cambio | **0.62s / 0.63s / 0.65s** |

Confirmado: el salto transatlántico era la causa dominante, no `connection_limit` (que no le
afecta a Informes en sí — sus 15 round-trips van en un único `$transaction`, una sola
conexión de todas formas). Con `eu-west4`↔`eu-west-3` (mismo continente, ~500 km en vez de
~6000), **Informes pasa de 2.4s a 0.65s — 3.7× más rápido.**

### #1 — Región (resultado final, todas las pantallas)
Medido tras el cambio de región, comparado con el estado post-`connection_limit`-fix
(`us-east4` todavía):

| Pantalla | Tras fix `connection_limit` (`us-east4`) | Tras mover a `eu-west4` |
|---|---|---|
| Informes | 2.4s | 0.65s |
| Inicio (kpis) | 0.60s | 0.35s |
| Personas | 0.73s | 0.34s |
| Agenda | 0.83s | 0.28s |
| Anotaciones | 0.62s | 0.35s |
| Procesos | 0.62s | 0.31s |
| Nómina | 0.62s | 0.40s |
| Documentos | 0.59s | 0.29s |
| Desempeño | 0.64s | 0.31s |
| Estructura | 0.60s | 0.29s |
| 5 peticiones del dashboard en paralelo (peor caso) | 0.69s | 0.45s |

Downtime: ninguno (confirmado sin volúmenes). Dominio público y variables de entorno: sin
cambios, confirmado tras el movimiento.

## Estado: TAREA 2 cerrada

Los 4 hallazgos (región, `connection_limit`, code-splitting, `/auth/me`) están resueltos,
desplegados en producción y medidos con datos de antes/después reales. Nada pendiente de esta
tarea.
