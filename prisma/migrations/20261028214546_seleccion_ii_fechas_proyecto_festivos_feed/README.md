# Migración Selección II — Tanda 1 (consolidada)

Una sola ventana de migración para las Tandas 1-3 de Selección II (fechas de proceso, proyecto en
oferta, historial de etapas, ámbito de festivos y token del feed ICS). Todo es aditivo y
compatible hacia atrás: el código anterior sigue funcionando mientras se despliega.

## Objetos que Prisma NO sabe expresar (viven solo en `migration.sql`)

| Objeto | Qué es | Por qué fuera del schema |
|---|---|---|
| `Holiday_ambito_chk` | `CHECK (paisId IS NOT NULL OR localizacionId IS NOT NULL) NOT VALID` | Prisma no modela CHECK. `NOT VALID` = no revalida filas heredadas. |
| `Holiday_pais_fecha_nombre_key` | Índice único PARCIAL `(paisId,date,name) WHERE localizacionId IS NULL` | Prisma no modela índices parciales. |
| `Holiday_loc_fecha_nombre_key` | Índice único PARCIAL `(localizacionId,date,name) WHERE localizacionId IS NOT NULL` | Idem. |
| RLS en `ApplicationEtapa` | `ENABLE ROW LEVEL SECURITY` | Prisma no activa RLS (lección #20). |

## Deriva: salida esperada de `prisma migrate diff` (verificada en dev el 2026-10-28)

```
npx dotenv -e .env.local -- prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
npx dotenv -e .env.local -- prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script
```

Con la BD migrada, **ambas direcciones devuelven `-- This is an empty migration.`** Prisma NO ve
los objetos manuales (CHECK, índices parciales, RLS): no los lista como deriva ni intenta
borrarlos. Por tanto:
- Salida vacía = estado sano.
- **Cualquier salida distinta de vacía es deriva REAL** (no es esta). Investigar antes de aplicar.
- La deriva «invisible» de estos objetos solo se detecta comprobando su existencia:
  `SELECT conname FROM pg_constraint WHERE conname='Holiday_ambito_chk'`,
  `SELECT indexname FROM pg_indexes WHERE indexname IN ('Holiday_pais_fecha_nombre_key','Holiday_loc_fecha_nombre_key')`,
  `SELECT relrowsecurity FROM pg_class WHERE relname='ApplicationEtapa'` (debe ser `true`).
- Riesgo residual: al generar una migración futura con `migrate dev`, el SQL generado podría
  intentar recrear estos objetos; revisarlo siempre antes de aplicar, y toda migración que toque
  `Holiday` debe conservarlos.

## Rellenos de datos
- `Job.openedAt = createdAt` (todas las ofertas existentes).
- `Application.fechaIncorporacion = Employee.startDate` para candidaturas CONTRATADO con ficha.
- `Holiday`: `location` → `localizacionId` por nombre; `location IS NULL` → nacional de España.

`Holiday.location` queda DEPRECADO (no se borra aquí; migración posterior).
