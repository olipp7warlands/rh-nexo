/** Estructura de navegación del Core (la barra lateral se construye desde aquí). */
export const NAV = [
  { section: 'Principal', items: [
    { key: 'inicio', label: 'Inicio', path: '/' },
    { key: 'empleados', label: 'Empleados', path: '/empleados' },
    { key: 'organigrama', label: 'Organigrama', path: '/organigrama' },
  ]},
  { section: 'Tiempo', items: [
    { key: 'ausencias', label: 'Ausencias', path: '/ausencias' },
    { key: 'fichaje', label: 'Fichaje', path: '/fichaje', soon: true },
    { key: 'calendario', label: 'Calendario', path: '/calendario' },
  ]},
  { section: 'Talento', items: [
    { key: 'reclutamiento', label: 'Reclutamiento', path: '/reclutamiento', tag: 'VITAE' },
    { key: 'desempeno', label: 'Desempeño', path: '/desempeno' },
    { key: 'onboarding', label: 'Onboarding', path: '/onboarding' },
  ]},
  { section: 'Empresa', items: [
    { key: 'nomina', label: 'Nómina', path: '/nomina' },
    { key: 'documentos', label: 'Documentos', path: '/documentos' },
    { key: 'informes', label: 'Informes', path: '/informes' },
  ]},
] as const;
