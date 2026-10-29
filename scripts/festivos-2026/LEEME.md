# Carga de festivos (calendarios 2026)

Carga `calendarios-2026.json` en la tabla `Holiday`. **Borrador hasta que RRHH revise**
`REVISION-RRHH.md` y su CSV.

```bash
# 1) Ensayo (siempre primero): valida, aplica y hace ROLLBACK; imprime el informe.
node --env-file=.env.local scripts/festivos-2026/cargar-festivos.cjs scripts/festivos-2026/calendarios-2026.json <refDev> dry
# 2) Carga real (solo con backup nombrado y confirmación expresa):
node --env-file=<env> scripts/festivos-2026/cargar-festivos.cjs scripts/festivos-2026/calendarios-2026.json <refEsperada> commit
```

- **Guarda de ref:** aborta si el proyecto Supabase de `DIRECT_URL` no es `<refEsperada>`.
- **Transaccional:** o entra todo o no entra nada. `dry` no deja rastro (ni festivos ni auditoría).
- **Idempotente:** lo que ya existe (mismo ámbito, fecha y nombre) se omite y se cuenta.
- **Aborta sin escribir nada** si falta un país, si falta una localización, si una localización es de
  otro país o no tiene país. Los festivos locales se vinculan por **nombre de localización**
  (insensible a mayúsculas); `aliasLocalizaciones` del JSON traduce el nombre del calendario al nombre
  real (p. ej. `"Karnataka": "Bengaluru"`). No se crean localizaciones desde aquí.
- Todo entra con `validado = false` y con su `fuente`; RRHH valida desde **Configuración → Festivos**
  (los de fecha aproximada, con «Confirmar fecha»).
- Un festivo de país se guarda con `paisId` y sin localización; uno local, con `localizacionId` y sin
  `paisId`. Deja una entrada `IMPORT` en `AuditLog` (sin actor: es un script).
- El fichero exige `fuente` en cada fila. Las filas sin fuente oficial accesible (Karnataka) están solo en
  el CSV de revisión, no en el JSON.
- Tests: `apps/api/test/festivos-carga.e2e-spec.ts`.
