# Nexo → humanX — Plan de transformación

> Documento de traspaso a Claude Code. Convierte el producto **Nexo** en **humanX**
> (grupo wowinX): renombrado, nueva capa visual, y la capa de *expediente / memoria /
> trazabilidad* de humanX **sumada** sobre lo que Nexo ya tiene.
> Complementa al `PLAN.md` y `CLAUDE.md` originales; no los sustituye.

---

## 1. Idea en una frase

humanX = **Nexo + capa de expediente digital**. Se **añade** todo lo que aporta humanX
(Anotaciones/Memoria, Agenda, Offboarding, histórico de puestos y salarial, alertas de
contrato, sociedades y catálogos, carga masiva, registro de accesos) y **se conserva** todo
lo que Nexo ya tiene y humanX no (Ausencias, Nómina, Desempeño, Documentos, Informes,
Reclutamiento/VITAE, Fichaje). Es sobre todo **sumar**, no rehacer.

Regla de oro sin cambios: la **Definición de Hecho** de `CLAUDE.md` (persiste, valida,
respeta permisos, audita, tiene test) aplica a cada acción nueva.

---

## 2. Decisiones de fondo (transversales)

- **Renombrado:** el producto pasa a llamarse **humanX**. Sustituir el nombre visible
  (wordmark, títulos, `<title>`, textos de `README.md` / `CLAUDE.md` / `PLAN.md`). El scope
  de paquetes `@nucleo/*` puede quedarse como está (no es visible al usuario); renombrarlo es
  opcional y de baja prioridad.
- **Roles:** se mantienen los **4 roles de Nexo** (ADMIN, RRHH, MANAGER, EMPLEADO). El rol
  "Dirección" de humanX (ve todo, solo lectura, con accesos registrados) **se mapea a ADMIN**;
  no se crea rol nuevo.
- **Registro de accesos a fichas:** **sí**. Cada apertura de la ficha de una persona escribe
  en el `AuditLog` existente (acción `VIEW`, entidad `Employee`). Visible como informe.
- **Capa visual (mezcla Clear + humanX):**
  - **Estructura, densidad, layouts y componentes → de Clear** (lo ya construido no se rehace).
  - **Paleta → monocroma blanco/negro** (como humanX). Se retira el cian como color de marca.
    **Única excepción:** los **colores de las categorías** de anotaciones, que codifican
    información y se mantienen como acento puntual.
  - **Tipografía → serif de marca en titulares y números destacados** (cabeceras de sección,
    nombre en la ficha, cifras grandes de KPIs), **Inter en todo el cuerpo** (tablas,
    formularios, etiquetas, datos). Se **conserva la escala tipográfica de Nexo** (mismos
    tamaños); solo cambia la *familia* en los titulares. Fuente serif por defecto:
    **Playfair Display** (Google Fonts) — sustituible por la serif de marca si la hay.
  - **Cómo se implementa:** redefiniendo los **tokens** del design system (color y fuente),
    no tocando pantalla por pantalla. Clear está tokenizado, así que el cambio se propaga solo.

---

## 3. Navegación fusionada (menú lateral)

Wordmark **humanX**. Cinco grupos, 16 entradas. Al pie: usuario + rol.

- **Principal**
  - **Inicio** — dashboard fusionado (KPIs de Nexo + alertas de contrato + últimas anotaciones)
  - **Agenda** — Hoy (feed del día) + Calendario mensual, en una sola sección
  - **Personas** — directorio (lista → ficha). Incluye acción **Importar** (carga masiva)
  - **Organigrama**
  - **Anotaciones** — memoria global. Incluye **Categorías** (gestión) como pestaña/acción
- **Tiempo**
  - **Ausencias**
  - **Fichaje** *(pronto — última fase, requiere hardware)*
- **Talento**
  - **Reclutamiento** *(VITAE)*
  - **Desempeño**
  - **Procesos** — Onboarding + Offboarding en pestañas
- **Empresa**
  - **Nómina**
  - **Documentos**
  - **Informes** — incluye **Registro de accesos** (log de aperturas de ficha)
- **Estructura**
  - **Sociedades** · **Localizaciones** · **Departamentos**

Criterio: cada "configuración" vive pegada a la sección que la usa (Categorías→Anotaciones,
Importar→Personas, Registro de accesos→Informes), en lugar de en un cajón "Catálogos".

---

## 4. Modelo de datos — qué añadir a Prisma

Sobre el `schema.prisma` actual. Dinero en euros (`Int`).

**Enums nuevos**
- `Vinculo { PLANTILLA EXTERNO }`
- `EstadoAnotacion { PENDIENTE HECHA }`
- `TipoProceso { ONBOARDING OFFBOARDING }`
- `EstadoProceso { NO_INICIADO EN_CURSO COMPLETADO CANCELADO }`
- `EstadoTarea { PENDIENTE EN_CURSO COMPLETADA BLOQUEADA CANCELADA }`

**`Employee` — campos a añadir**
- `codigo String?` (identificador interno, único por organización)
- `vinculo Vinculo @default(PLANTILLA)`
- `sociedadId String?` → relación a `Sociedad`
- `localizacionId String?` → relación a `Localizacion` (convertir el `location` texto actual)
- `finPeriodoPrueba DateTime?`
- `vencimientoContrato DateTime?`
- `descripcionPuesto String?`
- (el `salary` actual se mantiene como "último bruto"; el histórico vive en `RegistroSalarial`)

**Entidades nuevas — estructura**
- `Pais` (id, nombre) — catálogo pequeño (España, Dubái, India, Colombia, México… ampliable)
- `Sociedad` (id, nombre, paisId) → `Employee.sociedad`, `RegistroPuesto.sociedad`
- `Localizacion` (id, nombre)
- `Departamento` — **ya existe** (`Department`); solo se expone como catálogo editable

**Entidades nuevas — expediente**
- `RegistroPuesto` (id, empleadoId, fechaInicio, fechaFin?, titulo, sociedadId?, departamentoId?)
  — el puesto actual = registro sin `fechaFin`
- `RegistroSalarial` (id, empleadoId, fecha, concepto, brutoAnual) — la Δ se calcula en vista

**Entidades nuevas — memoria**
- `Categoria` (id, nombre, color, orden). **`Anotacion.categoriaId` con `onDelete: SetNull`**
  (borrar categoría no borra anotaciones: quedan "Sin categoría")
- `Anotacion` (id, empleadoId, categoriaId?, fecha, texto, autorId → User, estado
  `EstadoAnotacion`, hechaAt?, createdAt). La memoria global = todas; en ficha = filtradas por
  empleado. Es **nota + tarea ligera** (pendiente/hecha, marcar/reabrir).

**Procesos — generalizar lo existente**
- `OnboardingProcess` → **`Proceso`**: +`tipo TipoProceso`, +`estado EstadoProceso`, `nombre?`,
  `fechaInicio`, `fechaObjetivo`, `empleadoId`
- `OnboardingTask` → **`ProcesoTarea`**: `estado EstadoTarea` (sustituye el booleano `done`),
  `completadaAt?`, `responsable String`
- Plantilla maestra: **fases** con `orden`, `responsable` por tarea, y soporte de
  **duplicar / archivar** (versionado). Al iniciar un proceso se **congela** (copia) la
  plantilla activa (Nexo ya copia; verificar).

**Alertas de contrato** — no es entidad: es **lógica derivada** de `finPeriodoPrueba` y
`vencimientoContrato`. Para cada persona, si la fecha cae en la ventana (~desde unos días
atrás hasta ~6 semanas adelante) se genera una alerta con días restantes. Alimenta Inicio,
Agenda (Hoy + Calendario).

**Registro de accesos** — usa `AuditLog` (acción `VIEW`, entidad `Employee`, actor, fecha).

---

## 5. Fichas de sección (referencia)

Numeración de humanX. "Estado" = cómo llega a humanX.

1. **Inicio (Dashboard)** — *adaptar.* 3 métricas (personas plantilla/externos · sociedades
   por país · alertas activas) + paneles Alertas próximas y Últimas anotaciones. Se nutre de
   casi todo → se construye tarde. Fusiona el Inicio de Nexo con el dashboard de humanX.
2. **Agenda (Hoy + Calendario)** — *nuevo/adaptar.* Cabecera con fecha + 4 métricas + filtros
   (periodo, estado); feed cronológico de lo inmediato; y calendario mensual con eventos
   (anotaciones por color + alertas de contrato). Fuente: `Anotacion` + alertas. **Decisión
   pendiente:** ¿un calendario con capas (ausencias/expediente) o dos calendarios?
3. **Personas — lista** — *adaptar + enriquecer.* Tabla (nombre+puesto, sociedad,
   departamento, localización, incorporación, vínculo) + buscador + filtros (vínculo, país).
   Acciones: `+ Añadir persona`, **`Importar`** (carga masiva), fila → ficha. Formulario de
   alta con todos los campos nuevos (país se autocompleta desde sociedad).
4. **Ficha individual — detalle** — *adaptar + enriquecer.* Base Nexo (7 pestañas) + 3 bloques
   de humanX: **Histórico de puestos**, **Histórico salarial** (con Δ), **Anotaciones** (lista
   + compositor). Cabecera con antigüedad; `+ Nueva anotación`, `Editar ficha`. **Registra el
   acceso** al abrir. Se conserva la organización por pestañas de Nexo (no el "todo junto" de
   humanX).
5. **Anotaciones (Memoria)** — *nuevo.* Repositorio cronológico global. Filtros: persona,
   periodo, estado (pendientes/hechas), categoría (chips con conteo). Tarjetas con categoría,
   persona, sociedad, texto, estado; acciones marcar hecha / reabrir / eliminar. **Mejoras
   sobre humanX:** (a) crear anotación **desde aquí** con selector de persona; (b) crear
   **categoría al vuelo** desde el compositor. Categorías se gestionan dentro de esta sección.
6. **Procesos (Onboarding + Offboarding)** — *adaptar + generalizar.* Una sección, dos
   pestañas. Lista (persona, estado, progreso, objetivo) → detalle con checklist por fases y
   estados de tarea; filtros. `+ Iniciar` (congela plantilla). **Editor de plantilla maestra**
   (fases + tareas + responsables, duplicar, archivar). Se adopta el sistema de **estados** de
   Nexo/humanX (proceso: 4 estados; tarea: 5).
7. **Estructura (Sociedades / Localizaciones / Departamentos)** — *nuevo + existente.* Tres
   catálogos editables (añadir/editar/eliminar) con conteo de personas. Sociedades agrupa por
   país y lleva el país (de ahí el autocompletado en la ficha). Departamentos ya existe.
8. **Categorías** *(dentro de Anotaciones)* — *nuevo.* Catálogo de etiquetas con color y
   distribución de uso. Borrar categoría → sus anotaciones pasan a "Sin categoría".
9. **Cargas masivas** *(dentro de Personas)* — *nuevo.* Alta masiva desde CSV/XLSX con
   plantillas de descarga, **validación fila a fila** e **importación atómica** (todo o nada).
   Usa SheetJS (ya disponible). Solo ADMIN/RRHH.
10. **Registro de accesos** *(dentro de Informes)* — *adaptar.* Informe del `AuditLog`: quién
    abrió qué ficha y cuándo.

Módulos de Nexo que **se conservan sin cambios funcionales** (solo reciben la nueva piel):
Ausencias, Nómina, Documentos, Informes, Desempeño, Reclutamiento (VITAE), Organigrama,
Fichaje (pendiente).

---

## 6. Mejoras sobre humanX (decisiones de estructura)

1. Personas + Ficha individual → **una sección** (lista→detalle), no dos entradas de menú.
2. Hoy + Calendario → **Agenda** (dos zooms de la misma información).
3. Onboarding + Offboarding → **Procesos** con pestañas.
4. Sociedades/Localizaciones/Departamentos → grupo **Estructura**.
5. Crear anotación **desde la Memoria** (no solo desde la ficha).
6. Crear **categoría al vuelo** desde el compositor.
7. **Categorías** dentro de Anotaciones; **Importar** dentro de Personas; **Registro de
   accesos** dentro de Informes (nada de grupo "Catálogos" suelto).

---

## 7. Faseado para Claude Code

Cada fase en su rama/PR, con la Definición de Hecho y tests. Orden por dependencia.

### Fase A — Rebranding + capa visual
Renombrar Nexo → humanX (wordmark, títulos, metadatos, docs). Redefinir **tokens**: paleta
monocroma blanco/negro (conservando los colores de categoría como acento) y tipografía
(serif de marca / Playfair Display en titulares y números; Inter en cuerpo; misma escala).
Sin tocar componentes ni lógica. *Entregable: mismo producto, nueva piel y nombre.*

### Fase B — Modelo de datos
Migración Prisma con todos los enums, campos de `Employee` y entidades nuevas de la sección 4
(Pais, Sociedad, Localizacion, Categoria, Anotacion, RegistroPuesto, RegistroSalarial, y la
generalización Proceso/ProcesoTarea + plantillas con fases). Ampliar el `seed` con datos de
ejemplo (sociedades por país, vínculos, categorías con color, alguna anotación, histórico).
*Entregable: base de datos lista; nada de UI todavía.*

### Fase C — Estructura + Personas + Importar
Catálogos (Sociedades con país, Localizaciones, Departamentos editables) con CRUD. Enriquecer
Personas: campos nuevos, filtros (vínculo, país), autocompletado país-desde-sociedad. Acción
**Importar** (CSV/XLSX con validación atómica). *Entregable: alta individual y masiva reales.*

### Fase D — Anotaciones (Memoria) + Categorías
Entidad `Anotacion` operativa: memoria global con filtros, crear/marcar/reabrir/eliminar,
categorías (catálogo + al vuelo). Integrar el bloque de anotaciones en la ficha. *Entregable:
el núcleo de humanX funcionando.*

### Fase E — Ficha enriquecida
Histórico de puestos y salarial (con Δ), bloque de anotaciones, cálculo de antigüedad, y
**registro de acceso** al abrir ficha (AuditLog). *Entregable: expediente completo.*

### Fase F — Alertas + Agenda + Inicio
Motor de alertas de contrato (fin de prueba / vencimiento). **Agenda** (Hoy + Calendario) e
**Inicio** (dashboard fusionado) que consumen anotaciones + alertas. *Entregable: la capa
temporal y panorámica.*

### Fase G — Procesos
Generalizar Onboarding a **Procesos** (tipo, estados de proceso y tarea), añadir
**Offboarding**, y el **editor de plantilla maestra** (fases, responsables, duplicar,
archivar) con congelado al iniciar. *Entregable: procesos de entrada y salida completos.*

### Fase H — Navegación final
Reordenar el menú a los 5 grupos de la sección 3 (16 entradas), con Categorías/Importar/
Registro de accesos anidados donde corresponde. *Entregable: la navegación fusionada.*

> Fichaje sigue siendo la última fase del producto (requiere hardware); no forma parte de esta
> transformación.

---

## 8. Decisiones aún abiertas (confirmar al construir)

- **Fuente serif exacta** (Playfair Display por defecto hasta confirmar la de marca).
- **Colores exactos de categorías** (tomar de las capturas / design system de humanX).
- **Calendario**: ¿uno con capas (ausencias + expediente) o separados?
- **Contrato**: ¿ampliar el enum `ContractType` o añadir campo de jornada para reflejar
  "Indefinido a tiempo completo · Híbrida"?
- **Inicio**: ¿combina KPIs de Nexo + alertas/anotaciones de humanX, o se reorganiza?
