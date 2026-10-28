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

**Deriva:** `prisma migrate dev`/`diff` puede listar estos objetos como «no presentes en el schema».
No hay que borrarlos ni reescribirlos: si una migración futura generada por Prisma intenta
eliminarlos, hay que quitar esas líneas del SQL antes de aplicarla. Toda migración que toque `Holiday`
debe conservarlos. El schema lo recuerda en
el comentario de `model Holiday`.

## Rellenos de datos
- `Job.openedAt = createdAt` (todas las ofertas existentes).
- `Application.fechaIncorporacion = Employee.startDate` para candidaturas CONTRATADO con ficha.
- `Holiday`: `location` → `localizacionId` por nombre; `location IS NULL` → nacional de España.

`Holiday.location` queda DEPRECADO (no se borra aquí; migración posterior).
