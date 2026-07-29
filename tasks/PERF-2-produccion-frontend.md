# TAREA 2 — Rendimiento en producción y frontend: estado y medidas

> La pasada anterior (`tasks/lessons.md`, commit de rendimiento en `auditoria-seguridad`) solo
> midió backend en dev, con curl uno a uno — nunca reprodujo carga concurrente real ni el salto
> de red hasta producción. Esta pasada corrige eso: mide contra
> `https://nucleoapi-production.up.railway.app` con tráfico real de navegador.

## Hallazgos y su estado

| # | Hallazgo | Estado | Rama |
|---|---|---|---|
| 1 | Railway en `us-east4` (Virginia) vs Supabase producción en `eu-west-3` (París) — latencia transatlántica en cada round-trip a BD | ⏳ Pendiente — requiere que el usuario cambie la región en el dashboard de Railway (el token de proyecto no tiene permiso para la mutación `scale`) | — |
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
| | Antes (`connection_limit=1`, `us-east4`) | Tras `connection_limit=10` (aún en `us-east4`) |
|---|---|---|
| 3 medidas | 2.37s / 2.41s / 2.43s | 2.41s / 2.42s / 2.47s — **sin cambio** |

Esperado: Informes hace sus 15 round-trips dentro de un único `$transaction`, que usa una sola
conexión de todas formas — `connection_limit` no le afecta a él mismo, solo a la contención
**entre** peticiones distintas. Su coste real es la latencia de red por round-trip
(~150ms/round-trip medido), dominada por el salto `us-east4`↔`eu-west-3`. **Pendiente
remedir en cuanto se mueva la región (#1).**

## Pendiente

- Mover el servicio a `eu-west` (Amsterdam, `europe-west4-drams3a`) — el usuario lo hará desde
  el dashboard (el token de proyecto no puede ejecutar `railway service scale`). Confirmado sin
  downtime (no hay volúmenes) y las variables de entorno se conservan.
- Tras el cambio de región: remedir Informes (el hallazgo más grande que queda) y el resto de
  pantallas, para confirmar que el salto transatlántico era la causa dominante.
