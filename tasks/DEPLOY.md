# Despliegue a producción — Railway (API) + Vercel (web) + Supabase (DB + Storage)

Guía reproducible, paso a paso. Rama de origen: `deploy-produccion`.

## Arquitectura

- **Railway**: aloja la API NestJS (`apps/api`), un proceso Node persistente.
- **Vercel**: aloja el frontend (`apps/web`), build estático de Vite — más simple que Railway
  para una SPA (deploy automático por git push, previews por PR, sin gestionar un proceso).
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
*Storage → New bucket* → nómbralo (p. ej. `nucleo-docs`) y **NO lo marques como público** —
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

## 2. Railway (API)

### 2.1 Crear el servicio
*New Project → Deploy from GitHub repo* → selecciona este repositorio. Railway detectará
`railway.json` (en la raíz) automáticamente: build con Nixpacks
(`pnpm install --frozen-lockfile && pnpm --filter @nucleo/api build`) y arranque
(`prisma migrate deploy && node apps/api/dist/main.js`), con healthcheck en `/api/health`.

**Root Directory del servicio = raíz del repo** (no `apps/api`) — necesario para que `pnpm`
resuelva el workspace completo.

### 2.2 Variables de entorno
En el dashboard del servicio (*Variables*), pega:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | pooler de Supabase (1.2) |
| `DIRECT_URL` | directa de Supabase (1.2) |
| `JWT_SECRET` | genera uno fuerte, ver 2.3 |
| `JWT_REFRESH_SECRET` | otro distinto, ver 2.3 |
| `JWT_EXPIRES_IN` | `15m` (o el valor que uses hoy) |
| `WEB_ORIGIN` | dominio de Vercel una vez lo tengas (paso 3); mientras tanto puedes dejar `http://localhost:5173` y actualizarlo después — admite lista separada por comas |
| `STORAGE_PROVIDER` | `supabase` |
| `SUPABASE_URL` | de 1.4 |
| `SUPABASE_SERVICE_ROLE_KEY` | de 1.4 (secreta) |
| `SUPABASE_STORAGE_BUCKET` | el bucket que creaste en 1.3 |

`PORT` no hace falta fijarlo — Railway lo inyecta y la API ya lee `process.env.PORT`.

### 2.3 Generar secretos JWT fuertes
En tu máquina (no en el repo):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```
Ejecútalo dos veces (uno para `JWT_SECRET`, otro para `JWT_REFRESH_SECRET`) y pega cada
resultado directamente en Railway.

### 2.4 Desplegar
Railway despliega automáticamente al hacer push a la rama configurada (normalmente `master`).
Tras el primer deploy, comprueba:
```
GET https://<tu-dominio>.up.railway.app/api/health
→ { "status": "ok", "uptime": <number> }
```

---

## 3. Vercel (frontend)

### 3.1 Crear el proyecto
*Add New → Project* → importa el mismo repo. Vercel detecta el monorepo (pnpm-workspace.yaml).

### 3.2 Configuración
- **Root Directory**: `apps/web`.
- **Framework Preset**: Vite (autodetectado).
- **Build Command** / **Output Directory**: los que autodetecte Vercel para Vite
  (`pnpm build` → `dist`) son correctos; no hace falta tocarlos.

### 3.3 Variable de entorno
- `VITE_API_URL` = `https://<tu-dominio>.up.railway.app` (el dominio de Railway del paso 2,
  **sin** `/api` al final — el cliente ya lo añade).

### 3.4 Cerrar el círculo de CORS
Una vez tengas el dominio de Vercel (p. ej. `https://nexo-web.vercel.app`), vuelve a Railway y
actualiza `WEB_ORIGIN` con ese dominio (o una lista separada por comas si quieres admitir
también preview deployments, p. ej.
`WEB_ORIGIN=https://nexo-web.vercel.app,https://nexo-web-git-master-tuusuario.vercel.app`).

---

## 4. Migraciones y datos iniciales

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

---

## 5. Verificación de que está viva

1. `GET https://<railway-domain>/api/health` → `200 { status: "ok" }`.
2. Abre el frontend en Vercel, inicia sesión con una de las cuentas de prueba (ver
   `CLAUDE.md` — contraseña `nucleo123` para todas) y confirma que carga el listado de
   empleados (login real end-to-end: Vercel → Railway → Supabase).
3. Sube un documento con fichero real desde `/documentos` (RRHH/Admin) y descárgalo — confirma
   que `fileUrl` ya no es `mock://...` y que la descarga funciona (URL firmada de Supabase
   Storage, caduca a los 5 minutos).
4. Revisa en Supabase (*Table editor* → `AuditLog`) que las acciones quedan auditadas.

---

## 6. Almacenamiento — qué cambia entre entornos

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
| `DIRECT_URL` | `prisma/schema.prisma` | directa; solo migraciones/seed/studio |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` / `JWT_EXPIRES_IN` | `apps/api/src/auth/auth.service.ts` | genera secretos nuevos para producción, no reutilices los de `.env.example` |
| `PORT` | `apps/api/src/main.ts` | Railway lo inyecta solo |
| `WEB_ORIGIN` | `apps/api/src/main.ts` | lista separada por comas (CORS) |
| `STORAGE_PROVIDER` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | `apps/api/src/storage/` | `supabase` en producción |
| `SIGNATURE_PROVIDER` / `SIGNATURE_API_KEY` | `apps/api/src/documents/signature.provider.ts` | sin implementar todavía (mock siempre); no afecta a este despliegue |
| `VITE_API_URL` | `apps/web/src/lib/api.ts` | build-time de Vite, va en Vercel |

## 8. Advertencias

- `.env` está en `.gitignore` — nunca lo commitees. Las claves de producción viven **solo**
  en los dashboards de Railway/Vercel.
- La `SUPABASE_SERVICE_ROLE_KEY` es tan sensible como una contraseña de administrador de la
  base de datos — no la pongas en `VITE_*` (eso la expondría en el bundle del frontend).
- Rota `JWT_SECRET`/`JWT_REFRESH_SECRET` si alguna vez se filtran; invalida todas las sesiones
  activas.
