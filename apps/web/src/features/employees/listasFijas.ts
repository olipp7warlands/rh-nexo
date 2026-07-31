// humanX Tanda 2: listas fijas (no editables desde la app, ver prisma/schema.prisma
// enums Nacionalidad/SituacionIRPF). Mismo orden que el enum del backend.
export const NACIONALIDAD_LABEL: Record<string, string> = {
  ESPANOLA: 'Española',
  COLOMBIANA: 'Colombiana',
  MEXICANA: 'Mexicana',
  EMIRATI: 'Emiratí',
  INDIA: 'India',
  ARGENTINA: 'Argentina',
  CHILENA: 'Chilena',
  PERUANA: 'Peruana',
  PORTUGUESA: 'Portuguesa',
  FRANCESA: 'Francesa',
  ALEMANA: 'Alemana',
  ITALIANA: 'Italiana',
  BRITANICA: 'Británica',
  ESTADOUNIDENSE: 'Estadounidense',
  MARROQUI: 'Marroquí',
  RUMANA: 'Rumana',
  BRASILENA: 'Brasileña',
  VENEZOLANA: 'Venezolana',
  ECUATORIANA: 'Ecuatoriana',
  OTRA: 'Otra',
};

export const SITUACION_IRPF_LABEL: Record<string, string> = {
  SOLTERO_SIN_HIJOS: 'Soltero/a sin hijos',
  CASADO_UN_PERCEPTOR: 'Casado/a, un perceptor',
  CASADO_DOS_PERCEPTORES: 'Casado/a, dos perceptores',
  CON_DESCENDIENTES: 'Con descendientes a cargo',
  CON_ASCENDIENTES: 'Con ascendientes a cargo',
  DISCAPACIDAD: 'Discapacidad',
  FAMILIA_NUMEROSA: 'Familia numerosa',
  OTRA: 'Otra',
};
