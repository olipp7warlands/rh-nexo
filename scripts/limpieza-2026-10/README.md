# Limpieza de datos demo en producción — 28-oct-2026

Trazabilidad de lo ejecutado contra producción (Supabase `qkeadkgdzwzsvjvfczhv`) para pasar de
los datos del seed a datos reales. Son SQL con preflight, postcondiciones, idempotencia y
dry-run por defecto (`psql -v commit=true` para confirmar). **No volver a ejecutar sin revisar**:
el 02 borra datos y su preflight aborta si ya hay datos reales.

| Script | Qué hace | Resultado en producción (28-oct-2026) |
|---|---|---|
| `00-descubrimiento-solo-lectura.sql` | Solo `SELECT`: confirma que producción == seed y que no hay datos reales mezclados. | Prod igual al seed; 0 empleados/departamentos/candidatos reales. |
| `01-desactivar-cuentas-demo.sql` | Desactiva (`isActive=false`, nunca `DELETE`) las 4 cuentas `@grupo.com` y revoca sus refresh tokens. Guarda anti-lockout: exige `blanca.garcia@wowinx.com` activa y ADMIN. | 4 cuentas desactivadas, 18 tokens revocados, +4 `AuditLog`. |
| `02-limpieza-demo.sql` | Borra los datos demo en orden de FKs (17 empleados y todo lo que cuelga, 8 departamentos, 12 festivos, 5 localizaciones, 6 sociedades demo, países Colombia/México), renombra el país Dubái a Emiratos Árabes Unidos y crea las 14 sociedades reales (7 SL España + 7 FZCO EAU). | `commit=true`; +1 `AuditLog` `CLEANUP`; 14 sociedades, 3 países, 0 localizaciones/festivos/departamentos. Segunda pasada en dry-run: todos los deltas a 0. |
| `03-carga-departamentos.sql` | Carga los 16 departamentos reales (color por defecto `#0F1419`, sin responsable). | `commit=true`; 0 → 16 departamentos; +1 `AuditLog` `CREATE/Department`. Segunda pasada: deltas a 0. |

Todos se ensayaron antes en dev. No tocan `AuditLog` (solo insertan), ni `User` (filas), ni los
catálogos de Tanda 2, `Categoria`, `Stage` ni las plantillas.

Respaldo previo: backup automático de Supabase (madrugada del 28-oct) y `pg_dump --data-only`
local de las tablas afectadas (fuera del repo; contiene hashes de contraseña, borrar hacia el
2026-11-25).

## Runner: `run-sql.cjs`

Los SQL se ejecutaron con este runner de Prisma porque no había cliente `psql` instalado. Aplica el
mismo SQL sin las meta-órdenes de `psql` (`\echo`, `\if`, `BEGIN/COMMIT/ROLLBACK`), todo en UNA
transacción, imprime los recuentos antes/después y en modo `dry` hace `ROLLBACK`. Aborta si el
proyecto de la conexión no es el esperado. No contiene credenciales: lee `DIRECT_URL` del entorno.

```
node --env-file=<envfile> scripts/limpieza-2026-10/run-sql.cjs <fichero.sql> <refSupabaseEsperada> <dry|commit>
```

Nota: la ruta al `package.json` de la raíz (para resolver `@prisma/client`) está fija en el script
(`createRequire('C:/Proyectos CLAUDE/nucleo-humanx/package.json')`); ajustarla en otra máquina.
