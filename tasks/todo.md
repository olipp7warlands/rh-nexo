# Fase 5 — Informes · rama `fase-5-informes`

> Fases 0–3 fusionadas en `master` (`5b1e50c`). Fase 4 (Nómina) pendiente; Informes se calcula
> desde datos existentes (empleados, salario, ausencias, reviews). AC: cada métrica desde datos
> reales y cuadra con su módulo de origen. Filtros por departamento. Export.

## Bloque 1 — Backend ✅
- [x] 1a. `ReportsModule` (solo ADMIN/RRHH): GET /reports/overview?departmentId (headcount, rotación,
      absentismo por tipo, coste por área, distribución de desempeño, diversidad por ubicación/modalidad) + export CSV
- [x] 1b. Test: overview cuadra con conteos reales (suma por depto = activos; remoto+presencial = activos); RBAC 403

## Bloque 2 — Frontend ✅
- [x] 2. Dashboard `/informes`: 4 KPIs + 4 barras (plantilla/coste/desempeño/diversidad), filtro de depto,
      export CSV; mensaje de acceso restringido para roles sin permiso

## Bloque 3 — Cierre ✅
- [x] 3. 20/20 tests · build turbo 2/2 · overview verificado vía proxy (coste 959.000€, EMPLEADO 403)

## Revisión

**Fase 5 completada** en `fase-5-informes`. Cuadro de mando analítico desde datos reales:
- **Métricas**: headcount (total/estado/depto), rotación (bajas), absentismo (días aprobados, por tipo),
  coste de plantilla por área (Σ salario), distribución de desempeño (buckets de rating), diversidad
  (ubicación + remoto/presencial). Cuadran con sus módulos de origen (verificado en test).
- **Permisos**: dato sensible (coste) → solo ADMIN/RRHH; EMPLEADO/MANAGER reciben 403 y la UI lo explica.
- **Filtros**: por departamento. **Export**: CSV de plantilla y coste por área.

**Nota de alcance**: Fase 4 (Nómina) no construida; el coste se calcula desde `Employee.salary` (suficiente
para Informes). El modelo no tiene género → diversidad mostrada por ubicación/modalidad.

**Verificación**: 20/20 tests (2 nuevos) · build turbo 2/2 · overview vía proxy. Sin verificación visual (sin MCP).

### Siguiente
- Confirmar commit + fusión a master.
- Fase 4 (Nómina + Documentos) o Fase 6 (VITAE).
