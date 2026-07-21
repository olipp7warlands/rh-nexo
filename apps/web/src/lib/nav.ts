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
  { section: 'Estructura', items: [
    { key: 'sociedades', label: 'Sociedades', path: '/estructura/sociedades' },
    { key: 'localizaciones', label: 'Localizaciones', path: '/estructura/localizaciones' },
    { key: 'departamentos', label: 'Departamentos', path: '/estructura/departamentos' },
  ]},
] as const;
