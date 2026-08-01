import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@nucleo/ui';
import { SociedadesPage } from './SociedadesPage';
import { LocalizacionesPage } from './LocalizacionesPage';
import { DepartamentosPage } from './DepartamentosPage';
import { ProyectosPage } from './ProyectosPage';
import { TiposContratoPage } from './TiposContratoPage';
import { JornadasPage } from './JornadasPage';
import { RelacionesEmergenciaPage } from './RelacionesEmergenciaPage';
import { IdiomasPage } from './IdiomasPage';

// humanX: los 8 catálogos de Estructura/Config Informaciones consolidados en una sola página
// con pestañas (antes eran 8 entradas sueltas en el menú) — ver nav.ts, item "configuracion".
const TABS = [
  { key: 'sociedades', label: 'Sociedades', Component: SociedadesPage },
  { key: 'localizaciones', label: 'Localizaciones', Component: LocalizacionesPage },
  { key: 'departamentos', label: 'Departamentos', Component: DepartamentosPage },
  { key: 'proyectos', label: 'Proyectos', Component: ProyectosPage },
  { key: 'tipos-contrato', label: 'Tipos de contrato', Component: TiposContratoPage },
  { key: 'jornadas', label: 'Jornadas', Component: JornadasPage },
  { key: 'relaciones-emergencia', label: 'Relaciones de emergencia', Component: RelacionesEmergenciaPage },
  { key: 'idiomas', label: 'Idiomas', Component: IdiomasPage },
] as const;

export function ConfiguracionInformacionPage() {
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const active = TABS.find((t) => t.key === tabParam) ?? TABS[0];

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader
        eyebrow="Estructura"
        title="Configuración Información"
        subtitle="Catálogos y estructura organizativa del grupo."
      />

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-[var(--line)] mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/configuracion/${t.key}`)}
            className={`relative px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
              active.key === t.key ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
            }`}
          >
            {t.label}
            {active.key === t.key && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--accent)]" />}
          </button>
        ))}
      </div>

      <active.Component />
    </div>
  );
}
