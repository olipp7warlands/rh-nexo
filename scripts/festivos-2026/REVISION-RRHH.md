# Calendarios de festivos 2026 · revisión de RRHH (BORRADOR)

> **No se ha cargado nada en ninguna base de producción.** Este documento y
> `REVISION-RRHH-calendarios-2026.csv` (ábrelo con Excel; una fila por festivo) son para que RRHH
> los revise. Lo que se carga es `calendarios-2026.json`, siempre con `validado = false`; RRHH los
> valida después desde **Configuración → Festivos**.
>
> Compilado el 2026-10-29 por búsqueda web. Cada fila cita su fuente; la columna **Fuente oficial**
> del CSV distingue las oficiales (BOE, BOCM, Ayuntamiento, u.ae, gazettes `.gov.in`/`.nic.in`) de las
> que vienen de prensa. Revisar con la fuente delante antes de validar.

## Resumen

| Ámbito | Filas | En el fichero de carga | Fuente |
|---|---|---|---|
| España (nacionales) | 8 | 8 | BOE (Resolución DGT, calendario laboral 2026) |
| Madrid (autonómicos + capital) | 6 | 6 | Decreto 75/2025 (BOCM 25-09-2025); fiestas locales: Resolución DGT 2-12-2025 (BOCM 12-12-2025) |
| Emiratos Árabes Unidos | 13 | 13 | u.ae (lista y duración) + prensa que cita a MoHRE/FAHR para las fechas lunares |
| India (nacionales gazetted) | 17 | 17 | Notificación GAD del Gobierno NCT de Delhi 04-12-2025 (coincide con el memorándum DoPT, que no pudo abrirse) |
| Maharashtra | 9 | 9 | Gazette GAD Maharashtra 05-12-2025 |
| Delhi | 1 | 1 | Notificación GAD Delhi 04-12-2025 |
| **Karnataka** | 10 | **0 (pendientes)** | **Sin fuente oficial accesible** |

## Lo que RRHH debe decidir

### Bloqueantes
1. **Karnataka (10 filas, NO cargables).** No se pudo abrir `karnataka.gov.in` ni `dpar.karnataka.gov.in`; las fechas salen de un medio y de la referencia a la notificación DPAR 16 HHL 2025 (17-11-2025). Hace falta el PDF oficial. Dudas concretas: Makara Sankranti (14 o 15 de enero) y Valmiki Jayanti (domingo 25-oct, trasladado al lunes 26-oct según una notificación posterior no verificada). Están en el CSV con «SIN FUENTE» y fuera del JSON.
2. **Localizaciones.** Los festivos locales se enlazan por **nombre**. Hacen falta estas localizaciones, ya creadas con su país: `Madrid` (España), `Maharashtra`, `Delhi` (India), y `Karnataka` cuando haya fuente. Si RRHH las llama de otra forma (p. ej. `Bengaluru`, `Mumbai`), se indica en `aliasLocalizaciones` del JSON. **La carga aborta si falta alguna.** Nota: Maharashtra, Delhi y Karnataka son estados; si RRHH crea localizaciones por ciudad, un estado entero tendría que repartirse entre varias.

### Criterios míos a confirmar
3. **Festivos que caen en fin de semana** (se cargan igualmente, no restan días laborables): 15-ago España, 2-may Madrid (Fiesta de la Comunidad, sábado, el decreto no la traslada), 21 y 22-mar Emiratos, 21-mar, 15-ago y 8-nov India, 15-feb Maharashtra. ¿Cargarlos o descartarlos?
4. **Clasificación en España/Madrid.** El BOE solo distingue «no sustituible» y «sustituible no ejercida». He puesto como **nacional** el 6-ene y como **autonómicos de Madrid** el 2-abr (Jueves Santo), el 2-nov (traslado de Todos los Santos) y el 7-dic (traslado de la Constitución). Se aplican igual a quien trabaja en Madrid; solo cambia el ámbito (país frente a localización).
5. **Nombres de los festivos locales de Madrid** (San Isidro 15-may, Almudena 9-nov): el BOCM solo da las fechas; los nombres son los habituales.

### Emiratos Árabes Unidos
6. **Todas las fechas lunares van como `aproximado`** (Eid Al Fitr, Arafat, Eid Al Adha, Año Nuevo Hijri, Cumpleaños del Profeta): se confirman desde Configuración → Festivos con «Confirmar fecha».
7. **19-mar (día 30 de Ramadán)** incluido como día de Eid Al Fitr porque Ramadán completó 30 días; u.ae habla de «4 días». ¿Se carga?
8. **Seis filas con fuente de prensa, no oficial** (marcadas en el CSV): Arafat y Eid Al Adha (26–29 may, prensa que cita el anuncio de MoHRE), Año Nuevo Hijri (15-jun, Aletihad) y Cumpleaños del Profeta (28-ago, Khaleej Times, sin autoridad nombrada; se esperaba el 25-ago). El sector público (FAHR) tuvo un calendario distinto del privado.
9. Algunos festivos se trasladaron por decisión (Hijri al lunes 15-jun, Mawlid al viernes 28-ago); la Resolución 27/2024 no permite trasladar los que coinciden con fin de semana.

### India
10. **Id-ul-Zuha:** DoPT y Delhi dicen 27-may; Maharashtra (y la prensa de Karnataka) 28-may. Está el 27 como nacional y el 28 como estatal de Maharashtra; RRHH decide cuál manda (el festivo no aplicado se puede dejar sin validar).
11. **Holi:** nacional 4-mar, Maharashtra 3-mar (se incluye como estatal).
12. Maharashtra: la Bhaubeej (11-nov) sale en prensa pero no en la gazette de 05-12-2025; **no incluida**. El 1-abr es festivo solo bancario: excluido. Delhi tiene además 2 días de *restricted holidays* a elegir: excluidos.
13. Las fechas nacionales se leyeron en la notificación de Delhi (idéntica al memorándum DoPT, salvo Valmiki Jayanti); el PDF original del DoPT no estaba accesible.

## Cómo se cargará (cuando RRHH dé el visto bueno)
Ver `LEEME.md`: `dry` siempre primero (transacción con ROLLBACK), `commit` solo con backup nombrado y confirmación expresa. La carga de producción espera a que RRHH cree las localizaciones.
