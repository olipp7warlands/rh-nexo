/** Estructura de navegación de humanX (la barra lateral se construye desde aquí). */
export const NAV = [
  { section: 'Principal', items: [
    { key: 'inicio', label: 'Inicio', path: '/' },
    { key: 'agenda', label: 'Agenda', path: '/agenda' },
    { key: 'personas', label: 'Personas', path: '/personas' },
    { key: 'organigrama', label: 'Organigrama', path: '/organigrama' },
    { key: 'anotaciones', label: 'Anotaciones', path: '/anotaciones' },
  ]},
  // Oculto del menú lateral a petición (ver Sidebar.tsx) — sigue definido aquí a propósito:
  // las páginas y rutas de Ausencias/Fichaje se mantienen intactas y navegables por URL
  // directa (main.tsx genera rutas desde el NAV completo, sin filtrar). Reversible: basta con
  // quitar `hidden: true` para que reaparezca en el menú.
  { section: 'Tiempo', hidden: true, items: [
    { key: 'ausencias', label: 'Ausencias', path: '/ausencias' },
    { key: 'fichaje', label: 'Fichaje', path: '/fichaje', soon: true },
  ]},
  { section: 'Talento', items: [
    { key: 'procesos', label: 'Procesos', path: '/procesos' },
    { key: 'seleccion', label: 'Selección', path: '/seleccion', tag: 'VITAE' },
    { key: 'desempeno', label: 'Desempeño', path: '/desempeno' },
  ]},
  { section: 'Empresa', items: [
    { key: 'nomina', label: 'Nómina', path: '/nomina' },
    { key: 'documentos', label: 'Documentos', path: '/documentos' },
    { key: 'informes', label: 'Informes', path: '/informes' },
  ]},
  // Sin título: un grupo de una sola entrada no lleva cabecera de sección distinta al nombre
  // de su hijo (ver Sidebar.tsx, la cabecera se omite si `section` está vacío). Los 8 catálogos
  // editables de la ficha de Personas viven como sub-elementos de un único item acordeón.
  { section: '', items: [
    { key: 'configuracion', label: 'Configuración Información', path: '/configuracion', children: [
      { key: 'sociedades', label: 'Sociedades', path: '/configuracion/sociedades' },
      { key: 'localizaciones', label: 'Localizaciones', path: '/configuracion/localizaciones' },
      { key: 'departamentos', label: 'Departamentos', path: '/configuracion/departamentos' },
      { key: 'proyectos', label: 'Proyectos', path: '/configuracion/proyectos' },
      { key: 'tipos-contrato', label: 'Tipos de contrato', path: '/configuracion/tipos-contrato' },
      { key: 'jornadas', label: 'Jornadas', path: '/configuracion/jornadas' },
      { key: 'relaciones-emergencia', label: 'Relaciones de emergencia', path: '/configuracion/relaciones-emergencia' },
      { key: 'idiomas', label: 'Idiomas', path: '/configuracion/idiomas' },
    ]},
  ]},
] as const;
