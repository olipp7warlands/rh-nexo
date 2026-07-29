# Auditoría de seguridad — estado completo

> Registro persistente para que esto no se vuelva a perder entre sesiones (pasó una vez: M6,
> A3 y M5 se aprobaron en una sesión y no quedó ningún rastro en el repo de que existían,
> hasta que se preguntó por M6 explícitamente). Actualizar esta tabla en cualquier sesión
> futura que toque seguridad — no dejar hallazgos "aprobados" solo en el historial del chat.

## Altos (A)

| # | Hallazgo | Estado | Dónde |
|---|---|---|---|
| A1 | Sin rate limiting en login/refresh (fuerza bruta) | ✅ Resuelto | `ThrottlerModule` global + `@Throttle` estricto en login/refresh (`apps/api/src/auth/auth.controller.ts`) |
| A2 | Fallback hardcodeado de `JWT_SECRET` si faltaba la env var | ✅ Resuelto | `assertSecretsConfigured()` aborta el arranque (`apps/api/src/assert-secrets-configured.ts`) |
| A3 | Refresh tokens sin persistencia, sin rotación, sin detección de reutilización, sin logout real | ✅ Resuelto (esta sesión) | Ver detalle abajo |
| A4 | IDOR en candidatos: un MANAGER veía candidaturas de otro MANAGER en un candidato compartido | ✅ Resuelto | `candidates.service.ts` |
| A5 | HTML injection en el recibo de nómina | ✅ Resuelto | `escapeHtml()` en `payroll.service.ts` |

### A3 — detalle de lo implementado esta sesión
- **Persistencia**: modelo `RefreshToken` (Prisma) — el token real es opaco (32 bytes aleatorios, no JWT), se guarda solo su hash SHA-256 (`tokenHash`), nunca en claro.
- **Rotación**: cada `POST /auth/refresh` revoca el token usado y emite uno nuevo en la misma `familyId`.
- **Detección de reutilización**: reutilizar un token ya revocado (rotado o robado) revoca **toda la familia**, incluido el token "bueno" más reciente — fuerza a re-loguearse.
- **Logout real**: `POST /auth/logout` revoca la familia entera. Frontend (`AuthContext.logout()`) lo llama en cada logout, best-effort (no bloquea el logout local si falla la red).
- Tests: `apps/api/test/auth.e2e-spec.ts` (persistencia hasheada, rotación, reutilización, logout, logout idempotente).

## Medios (M)

| # | Hallazgo | Estado | Dónde |
|---|---|---|---|
| M1 | IDOR en almacenamiento local de documentos | ✅ Resuelto | `local-storage.controller.ts` exige ser dueño/firmante |
| M2 | MIME spoofing en subida de documentos (`file.mimetype` lo rellena el cliente) | ✅ Resuelto | `documents.service.ts` comprueba magic bytes reales |
| M3 | CSV/formula injection en exportaciones | ✅ Resuelto | `apps/api/src/lib/csv-safe.ts` |
| M4 | Sin cabeceras de seguridad (Helmet) | ✅ Resuelto | `security-headers.ts` |
| M5 | CVEs en dependencias (multer, @nestjs/core, qs, file-type, lodash) | ✅ Revisado y resuelto donde aplica (esta sesión) | Ver detalle abajo |
| M6 | Sin `isActive`/estado en `User`; `login()`/`refresh()`/`validate()` no lo comprobaban | ✅ Resuelto (esta sesión) | Ver detalle abajo |

### M5 — detalle de lo implementado esta sesión
`pnpm audit` antes: **28 vulnerabilidades** (1 crítica, 11 altas, 12 moderadas, 4 bajas).
Después: **14**, todas exclusivamente en la cadena de `@nestjs/cli`/`vitest` (herramientas de
build/test, nunca presentes en `apps/api/dist/main.js`, el artefacto que corre en producción —
no alcanzables por un atacante externo).

- **Arreglado vía `pnpm.overrides`** (raíz `package.json`): `multer` ≥2.2.0, `file-type` ≥21.3.2,
  `lodash` ≥4.18.0, `qs` ≥6.15.2, `body-parser` ≥1.20.6, `brace-expansion` ≥2.1.2.
- **`@nestjs/core` — verificado no explotable, migración diferida a propósito**: el CVE es
  específico de `SseStream` (Server-Sent Events); confirmado por grep que este proyecto no usa
  `@Sse`/`EventSource` en ningún sitio. El fix requiere NestJS 11 (venimos de la línea 10.x),
  una migración mayor con guía de actualización propia — no se hace a ciegas dentro de un
  parche de seguridad puntual sin la migración y sus pruebas dedicadas. Revisar de nuevo si el
  proyecto empieza a usar SSE.
- **Resto (14 restantes: esbuild, tmp, glob, webpack, ajv, picomatch, vite, vitest)**: todas
  dev-only (cadena `@nestjs/cli`→webpack/glob/ajv/picomatch/tmp, `vitest`→vite/esbuild).
  Bumpearlas (sobre todo vitest 2→3) es un salto mayor de tooling sin beneficio de seguridad
  real en producción — no se ha hecho.

### M6 — detalle de lo implementado esta sesión
- `User.isActive Boolean @default(true)` (migración `20260721133300_humanx_auditoria_m6_a3_auth`).
- `AuthService.login()`: cuenta inactiva → mismo 401 genérico que credenciales inválidas (no
  se filtra si la cuenta existe pero está desactivada).
- `AuthService.refresh()`: comprueba `isActive` del usuario dueño del token antes de rotar.
- `JwtStrategy.validate()`: **ahora consulta la BD en cada request autenticado** (antes solo
  proyectaba el payload firmado) — revalida `role` e `isActive` frescos. Cambia rol/desactiva
  una cuenta y el efecto es inmediato, sin esperar a que caduque el access token (hasta 15 min
  antes). Coste: una query Prisma más por request — mencionado también en TAREA 2 (perf).
- Tests: `apps/api/test/auth.e2e-spec.ts` (login rechazado si inactiva, revocación a mitad de
  sesión, revalidación de rol vía `RolesGuard` real — no solo `/me`, que ya hacía su propia
  consulta y no habría demostrado nada).

## Bajos (B)

> La lista original B1-B5 no quedó documentada en ningún sitio del repo (mismo problema que
> M6/A3/M5) y ni el usuario ni quien encargó la auditoría original conservan el enunciado
> completo. Esta sesión hizo una pasada nueva sobre el código actual a partir de dos pistas
> recordadas + hallazgos propios — no se corresponde necesariamente 1:1 con la lista original.

| Hallazgo | Estado | Dónde |
|---|---|---|
| `pnpm db:seed` podía correr contra producción sin ninguna barrera (borra y reinserta con contraseñas conocidas, `nucleo123`) | ✅ Resuelto | `scripts/assert-not-seeding-production.ts` — aborta salvo `SEED_ALLOW_PRODUCTION=<token>` explícito |
| Ningún campo de texto libre tenía `@MaxLength` en ningún DTO (fullName, jobTitle, texto de anotaciones, descripciones, feedback...) | ✅ Resuelto | `@MaxLength` añadido en las 15 clases DTO de `apps/api/src/**/*.dto.ts`; login limitado a 72 (límite real de bcrypt) |
| IP-based throttling (A1) posiblemente compartido entre TODOS los clientes detrás del proxy de Railway, por falta de `trust proxy` | ✅ Resuelto (hallazgo nuevo, encontrado esta sesión) | `app.getHttpAdapter().getInstance().set('trust proxy', 1)` en `apps/api/src/main.ts` |

**No identificados/verificados esta sesión** (huecos honestos, no "no hay nada más"):
- Faltan los otros ~2 hallazgos bajos originales que nadie recuerda.
- No se ha revisado si conviene mover los tokens de `localStorage` a cookies `httpOnly`
  (mitigaría XSS robando tokens) — es un cambio de arquitectura, no un "hallazgo barato".

## Resumen para la próxima sesión

- **Cerrado esta sesión**: A3, M5 (parcial, justificado), M6, y 3 hallazgos bajos.
- **Pendiente real**: ninguno de los altos/medios conocidos. Bajo: reconstruir/verificar si
  quedan más hallazgos B originales; decidir si migrar tokens a cookies `httpOnly` algún día.
- **Suite**: 149/149 tests en verde (`pnpm --filter @nucleo/api test`), build API+web limpio.
- Todo esto vive en la rama `seguridad-auth`, sin mergear a `master` — Railway tiene el
  auto-deploy ACTIVO ahora mismo, así que cualquier merge = deploy inmediato. La migración de
  M6/A3 (`20260721133300_humanx_auditoria_m6_a3_auth`) tiene que aplicarse a producción ANTES
  de mergear, igual que se hizo con las migraciones de humanX.
