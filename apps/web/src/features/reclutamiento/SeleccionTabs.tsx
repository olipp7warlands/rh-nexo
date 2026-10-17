import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/seleccion', label: 'Ofertas', end: true },
  { to: '/seleccion/historico', label: 'Histórico de candidatos', end: true },
] as const;

/**
 * Subpestañas de Selección. La URL coincide con el nombre visible (/seleccion/historico ↔
 * "Histórico de candidatos"). Solo se pinta para ADMIN/RRHH (quien puede ver el histórico); un
 * MANAGER ve Selección sin pestañas, como hasta ahora.
 */
export function SeleccionTabs() {
  return (
    <nav aria-label="Secciones de Selección" className="flex gap-6 border-b border-[var(--line)] mb-6">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `-mb-px pb-3 text-[13px] font-medium border-b-2 transition-colors ${
              isActive
                ? 'border-[var(--ink-primary)] text-[var(--ink-primary)]'
                : 'border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
