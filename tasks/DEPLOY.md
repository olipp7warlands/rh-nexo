# Despliegue a producción — Railway (todo en uno) + Supabase (DB + Storage)

Guía reproducible, paso a paso. Rama de origen: `deploy-produccion`.

## Arquitectura

- **Un único servicio de Railway** sirve tanto la API NestJS (`apps/api`) como el build
  estático de Vite (`apps/web`) — una sola URL pública, sin CORS real en producción (mismo
  origen). Railway es el único proveedor de hosting.
- **Supabase**: Postgres gestionado (con pooler) + Storage (bucket privado para documentos).
- Sin Docker en producción. `docker-compose.yml` sigue existiendo solo para Postgres en local.

---

## 1. Supabase

### 1.1 Crear el proyecto
En [supabase.com](https://supabase.com) → *New project*. Elige región cercana a Railway (p. ej.
`eu-west` si tu servicio de Railway está en Europa) para minimizar latencia. Anota la
contraseña de la base de datos que definas ahí.

### 1.2 Cadenas de conexión (Prisma)
*Project Settings → Database → Connection string*:
- **`DATABASE_URL`** = la cadena de **"Connection pooling"**, modo **Transaction**, puerto
  **6543**, con `?pgbouncer=true&connection_limit=1`. Es la que usa la API en cada request.
- **`DIRECT_URL`** = **verificado en despliegue real**: la conexión directa clásica
  (`db.<ref>.supabase.co:5432`) es **IPv6-only** y falla con `P1001` desde redes sin salida
  IPv6 (el caso más común). La alternativa oficial de Supabase: usar el mismo host del
  *pooler* pero en **modo Session** (puerto **5432**, sin `pgbouncer=true`) — sí soporta los
  bloqueos de esquema que necesitan `prisma migrate deploy`/`db:seed`/`db:studio`, y es
  accesible por IPv4. Es decir: `DATABASE_URL` y `DIRECT_URL` acaban compartiendo el mismo
  host del pooler, solo cambia el puerto (6543 transacción / 5432 sesión) y el parámetro
  `pgbouncer`.

Ambas comparten usuario/contraseña/nombre de base de datos; solo cambia el puerto y los
parámetros de query. Si tu red sí tiene salida IPv6, la conexión directa clásica también
funciona para `DIRECT_URL` — pero no lo asumas sin comprobarlo primero.

### 1.3 Bucket de Storage (documentos)
*Storage → New bucket* → nómbralo (p. ej. `documents`) y **NO lo marques como público** —
el backend usa URLs firmadas de corta duración (5 min) generadas bajo demanda, con el mismo
control de permisos (RBAC) que ya protege cada documento en la aplicación. Un bucket público
saltaría ese control.

### 1.4 Credenciales de API (Storage)
*Project Settings → API*:
- `SUPABASE_URL` = "Project URL".
- `SUPABASE_SERVICE_ROLE_KEY` = **service role key** (no la `anon`/`publishable`). Es secreta:
  tiene privilegios de administrador sobre el proyecto — solo va en variables de entorno del
  backend (Railway), nunca en el frontend ni en el repo.

---

## 2. Railway — un solo servicio (API + frontend)

### 2.1 Crear/enlazar el proyecto
*New Project → Deploy from GitHub repo* (o `railway link` desde la CLI si ya existe el
proyecto) → selecciona este repositorio. Railway detecta `railway.json` (en la raíz):

- **Build**: `pnpm install --frozen-lockfile && pnpm --filter @nucleo/web build && pnpm --filter @nucleo/api build`
  — construye el frontend (`apps/web/dist`) y la API (`apps/api/dist`) en el mismo build.
- **Start**: `npx prisma migrate deploy && node apps/api/dist/main.js` — aplica migraciones
  pendientes y arranca. La API sirve el frontend ya compilado desde el mismo proceso
  (`ServeStaticModule`, ver `apps/api/src/app.module.ts`) y expone el healthcheck en
  `/api/health`.

**Root Directory del servicio = raíz del repo** (no `apps/api`) — necesario para que `pnpm`
resuelva el workspace completo y ambos builds queden en el mismo filesystem del contenedor.

### 2.2 Variables de entorno
En el dashboard del servicio (*Variables*) — o por CLI con
`railway variable set NOMBRE --stdin` para no dejar el valor en el historial de la shell:

| Variable | Valor | ¿Cambia respecto a tu `.env` local? |
|---|---|---|
| `DATABASE_URL` | pooler de Supabase (1.2) | No |
| `DIRECT_URL` | directa/sesión de Supabase (1.2) | No |
| `JWT_SECRET` | genera uno **nuevo** para producción, ver 2.3 | Sí |
| `JWT_REFRESH_SECRET` | genera uno **nuevo**, distinto del anterior | Sí |
| `JWT_EXPIRES_IN` | `15m` (o el valor que uses hoy) | No |
| `PORT` | **no la fijes** — Railway la inyecta sola | N/A |
| `WEB_ORIGIN` | el dominio público que te dé Railway tras el primer deploy | Cambia el valor, pero **ya no es determinante**: con un solo servicio, frontend y API comparten origen exacto — el navegador nunca activa CORS en same-origin. Queda como red de seguridad, no porque bloquee nada hoy. |
| `STORAGE_PROVIDER` | `supabase` | No |
| `SUPABASE_URL` | de 1.4 | No |
| `SUPABASE_SERVICE_ROLE_KEY` | de 1.4 (secreta) | No |
| `SUPABASE_STORAGE_BUCKET` | el bucket que creaste en 1.3 | No |
| `VITE_API_URL` | **no la definas / bórrala si la tenías** | Con un solo servicio, el frontend llama a rutas relativas (`/api/...`) que resuelven al mismo dominio. `apps/web/src/lib/api.ts` hace `BASE = import.meta.env.VITE_API_URL ?? ''`; sin la variable, `BASE=''` y todo funciona sin configurar nada más. |

### 2.3 Generar secretos JWT fuertes
En tu máquina (no en el repo):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```
Ejecútalo dos veces (uno para `JWT_SECRET`, otro para `JWT_REFRESH_SECRET`) y pégalos en
Railway (dashboard o `railway variable set JWT_SECRET --stdin`).

### 2.4 Desplegar
Railway despliega automáticamente al hacer push a la rama configurada, o con `railway up`
desde la CLI. Tras el primer deploy, comprueba:
```
GET https://<tu-dominio>.up.railway.app/api/health
→ { "status": "ok", "uptime": <number> }
```
Y abre `https://<tu-dominio>.up.railway.app/` en el navegador — debe cargar el frontend
completo (login real, mismo dominio para todo).

---

## 3. Migraciones y datos iniciales

**Desde tu máquina**, con `DATABASE_URL`/`DIRECT_URL` de Supabase en tu `.env` local (no en el
`.env` de desarrollo con Docker — usa uno aparte o expórtalas puntualmente en la shell):

```bash
# Aplica el histórico de migraciones (no pregunta nada, no siembra)
pnpm db:migrate:deploy

# Solo la PRIMERA vez, para tener datos de demo (17 empleados, seed de VITAE, etc.)
pnpm db:seed
```

**Nunca** ejecutes `pnpm db:reset` ni vuelvas a correr `pnpm db:seed` contra Supabase una vez
haya datos reales — `db:seed` borra y re-inserta todo (ver `prisma/seed.ts`); está pensado para
desarrollo local, no para producción.

En Railway, `prisma migrate deploy` ya corre automáticamente en cada arranque (ver
`railway.json`) — aplica migraciones nuevas sin intervención, pero nunca siembra.

> **Corriendo tests localmente después de tocar `.env` con credenciales de Supabase reales:**
> sobreescribe `DATABASE_URL`/`DIRECT_URL`/`STORAGE_PROVIDER` inline para no ejecutar los
> tests contra producción por accidente:
> ```bash
> DATABASE_URL="postgresql://nucleo:nucleo@localhost:5432/nucleo?schema=public" \
> DIRECT_URL="postgresql://nucleo:nucleo@localhost:5432/nucleo?schema=public" \
> STORAGE_PROVIDER="" \
> pnpm --filter @nucleo/api test
> ```

---

## 4. Verificación de que está viva

1. `GET https://<railway-domain>/api/health` → `200 { status: "ok" }`.
2. Abre la URL raíz de Railway en el navegador, inicia sesión con una de las cuentas de prueba
   (ver `CLAUDE.md` — contraseña `nucleo123` para todas) y confirma que carga el listado de
   empleados (login real end-to-end, mismo dominio).
3. Navega directamente a una ruta profunda (p. ej. `https://<dominio>/empleados`) o refresca
   la página en una — debe seguir funcionando (fallback de SPA, ver §5).
4. Sube un documento con fichero real desde `/documentos` (RRHH/Admin) y descárgalo — confirma
   que `fileUrl` ya no es `mock://...` y que la descarga funciona (URL firmada de Supabase
   Storage, caduca a los 5 minutos).
5. Revisa en Supabase (*Table editor* → `AuditLog`) que las acciones quedan auditadas.

---

## 5. Cómo sirve la API el frontend (y un gotcha real que costó depurar)

`apps/api/src/app.module.ts` registra `ServeStaticModule.forRoot({ rootPath:
join(__dirname, '..', '..', 'web', 'dist'), exclude: [...], renderPath: '*' })` — sirve los
ficheros de `apps/web/dist` y hace fallback a `index.html` para cualquier ruta no reconocida
(necesario para que el enrutado de cliente de React Router funcione en recargas/enlaces
directos, p. ej. `/empleados/123`).

**Gotcha verificado en despliegue real** — dos versiones distintas de `path-to-regexp`
conviven en el mismo proceso y cada una entiende una sintaxis de comodín distinta:
- `exclude` lo evalúa `@nestjs/serve-static` con **su propia** dependencia de `path-to-regexp`
  (v8, sintaxis de wildcard con nombre): hay que usar `'/api/{*splat}'`, NO `'/api/(.*)'`
  (sintaxis vieja — **lanza una excepción** con v8 y rompe el fallback en silencio).
- `renderPath` lo registra **Express** con su propia `path-to-regexp` (v0.1.x, la que trae
  `express@4` como dependencia): el valor por defecto del paquete (`'{*any}'`, sintaxis v8)
  **no coincide con nada** bajo esa versión antigua — hay que fijarlo explícitamente a la
  sintaxis clásica: `renderPath: '*'`.

Si alguna vez tocas esta configuración y las rutas profundas del SPA empiezan a devolver 404,
es casi seguro este mismo problema — comprueba ambos patrones contra la versión de
`path-to-regexp` que realmente se está usando en cada punto (no asumas por la documentación).

---

## 6. Almacenamiento

`apps/api/src/storage/` implementa `StorageProvider` con dos backends intercambiables (mismo
patrón que `SignatureProvider` en `documents/signature.provider.ts`), seleccionados por
`STORAGE_PROVIDER`:

- **`STORAGE_PROVIDER=supabase`** (Railway/producción): `SupabaseStorageProvider` — sube al
  bucket privado y genera URLs firmadas de 5 minutos bajo demanda en
  `GET /documents/:id/download` (que primero comprueba que el viewer puede ver ese documento
  concreto — mismo RBAC que el resto de la app — y solo entonces redirige a la URL firmada).
- **`STORAGE_PROVIDER=""` (o cualquier otro valor)** — dev/test local: `LocalStorageProvider`,
  escribe en `apps/api/storage-local/` (fuera de git) y lo sirve `LocalStorageController` en
  `GET /storage/local/:key` (requiere sesión). No usa Railway ni tiene disco persistente —
  **no es apto para producción**, solo para desarrollar sin cuenta de Supabase.

Los documentos creados **sin** fichero adjunto siguen teniendo `fileUrl: "mock://..."` (no
hay nada que descargar) — es el comportamiento de siempre, sin cambios.

---

## 7. Variables de entorno — resumen completo

Ver `.env.example` para la lista completa con comentarios. Resumen de qué lee cada una:

| Variable | Dónde se lee | Notas |
|---|---|---|
| `DATABASE_URL` | `prisma/schema.prisma` | pooler en producción |
| `DIRECT_URL` | `prisma/schema.prisma` | pooler en modo sesión; solo migraciones/seed/studio |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` / `JWT_EXPIRES_IN` | `apps/api/src/auth/auth.service.ts` | genera secretos nuevos para producción, no reutilices los de dev |
| `PORT` | `apps/api/src/main.ts` | Railway lo inyecta solo |
| `WEB_ORIGIN` | `apps/api/src/main.ts` | lista separada por comas (CORS); no determinante en el modelo de un solo servicio |
| `STORAGE_PROVIDER` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | `apps/api/src/storage/` | `supabase` en producción |
| `SIGNATURE_PROVIDER` / `SIGNATURE_API_KEY` | `apps/api/src/documents/signature.provider.ts` | sin implementar todavía (mock siempre); no afecta a este despliegue |
| `VITE_API_URL` | `apps/web/src/lib/api.ts` | **no la definas en Railway** — un solo servicio usa rutas relativas |

## 8. Advertencias

- `.env` está en `.gitignore` — nunca lo commitees. Las claves de producción viven **solo**
  en el dashboard/CLI de Railway.
- La `SUPABASE_SERVICE_ROLE_KEY` es tan sensible como una contraseña de administrador de la
  base de datos — no la pongas en `VITE_*` (eso la expondría en el bundle del frontend).
- Rota `JWT_SECRET`/`JWT_REFRESH_SECRET` si alguna vez se filtran; invalida todas las sesiones
  activas.
- Al usar `railway variable set`, prefiere `--stdin` (`echo "valor" | railway variable set
  CLAVE --stdin`) en vez de `--set CLAVE=valor`, para que el secreto no quede en el historial
  de la shell ni en la lista de procesos.
