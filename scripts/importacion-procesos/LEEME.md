# Plantilla de importación de procesos históricos

**Una fila por candidatura.** Las filas con la misma oferta (título + sociedad + fecha de apertura)
forman UNA oferta; todos sus campos `oferta_*` deben ser idénticos en esas filas (si no, el script
lo rechaza). Separador `;`, UTF-8 (con BOM, abre bien en Excel), fechas `AAAA-MM-DD`.

> **Datos personales de terceros (RGPD).** El CSV con datos reales **no se commitea ni se pega en
> ningún chat**: se guarda fuera del repo (`scripts/importacion-procesos/real/` está en
> `.gitignore` por si acaso), se entrega por un canal privado y **se borra tras la carga**.
> `plantilla-procesos.csv` solo contiene filas ficticias.

| Columna | Oblig. | Valores / regla |
|---|---|---|
| `oferta_titulo` | sí | Texto, máx. 200. |
| `oferta_sociedad` | sí | Nombre EXACTO de una de las 14 sociedades (p. ej. `Colibri Live SL`). |
| `oferta_departamento` | no | Nombre EXACTO de uno de los 16 departamentos. |
| `oferta_proyecto` | no | Nombre EXACTO de un proyecto ya creado en el catálogo. Si no existe → error (no se crea solo). |
| `oferta_ubicacion` | sí | Texto libre (campo `Job.location`), máx. 200. |
| `oferta_nivel` | sí | Texto libre (Junior / Mid / Senior…), máx. 50. |
| `oferta_tipo_contrato` | no | `INDEFINIDO` (por defecto), `TEMPORAL`, `PRACTICAS`, `FREELANCE`. |
| `oferta_remoto` | no | `SI` / `NO` (por defecto `NO`). |
| `oferta_vacantes` | no | Entero ≥ 1 (por defecto 1). |
| `oferta_apertura` | sí | Fecha real de apertura del proceso. |
| `oferta_cierre` | cond. | Fecha de cierre. **Obligatoria si `oferta_estado` = CERRADA**; vacía en las demás. Debe ser ≥ apertura. |
| `oferta_estado` | sí | `ABIERTA`, `PAUSADA` o `CERRADA` (no se importan borradores). |
| `candidato_nombre` | sí | Nombre completo. |
| `candidato_email` | no | Email real si existe. **Si falta**, el script genera un email técnico único `importado+<hash>@candidatos.humanx.invalid` (dominio reservado `.invalid`, nunca entregable); es la marca «importado» que la fase RGPD de emails debe excluir. Un mismo email real en varias filas = la misma persona. |
| `candidato_telefono` | no | Texto libre. |
| `candidato_ubicacion` | no | Texto libre (filtro «ubicación» del histórico). |
| `candidato_origen` | no | `PORTAL`, `REFERIDO`, `LINKEDIN`, `AGENCIA`, `OTRO` (por defecto `OTRO`). |
| `candidato_linkedin` | no | URL. |
| `postulacion_fecha` | sí | Fecha real de postulación. No puede ser anterior a `oferta_apertura`. |
| `postulacion_estado` | sí | `ACTIVO`, `RECHAZADO`, `CONTRATADO`, `RETIRADO`. |
| `postulacion_etapa` | sí | Etapa **final** alcanzada: `Nuevo`, `Cribado`, `Entrevista`, `Prueba técnica`, `Oferta`, `Contratado`. |
| `incorporacion_fecha` | cond. | **Obligatoria si `postulacion_estado` = CONTRATADO**; vacía en las demás. Debe ser ≥ `postulacion_fecha`. |

## Reglas de coherencia (el script las valida y no carga nada si alguna falla)
- Un candidato (por email) no puede repetirse dentro de la misma oferta.
- `CONTRATADO` ⇒ etapa `Contratado` y con `incorporacion_fecha`. Importar un contratado **no crea
  ficha de empleado** (eso es onboarding real; aquí solo se registra el histórico).
- La importación **no** rellena el historial etapa a etapa (`ApplicationEtapa`): solo la etapa final.
- Todo es idempotente: volver a ejecutar el mismo CSV no duplica ofertas ni candidaturas.

## Flujo (mismo patrón que la limpieza de octubre)
1. Blanca rellena el CSV con la plantilla y lo entrega por canal privado.
2. En dev solo se ensaya con la plantilla ficticia (nunca con datos reales).
3. Dry-run contra producción (ROLLBACK): informe de filas, ofertas y candidatos nuevos/existentes,
   errores por fila. 4. Confirmación expresa, backup verificado y commit. 5. Se borra el CSV.
