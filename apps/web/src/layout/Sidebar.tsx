import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  Euro,
  FileText,
  Home,
  Layers,
  LogOut,
  MapPin,
  Network,
  Plane,
  Rocket,
  StickyNote,
  Target,
  Users,
} from 'lucide-react';
import { Avatar, Badge, cn } from '@nucleo/ui';
import { NAV } from '../lib/nav';
import { useAuth, type Role } from '../features/auth/AuthContext';

// Iconos por clave de navegación (estilo Lucide, como en el mockup).
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  inicio: Home,
  agenda: CalendarDays,
  personas: Users,
  organigrama: Network,
  anotaciones: StickyNote,
  ausencias: Plane,
  fichaje: Clock,
  seleccion: Briefcase,
  desempeno: Target,
  procesos: Rocket,
  nomina: Euro,
  documentos: FileText,
  informes: BarChart3,
  sociedades: Building2,
  localizaciones: MapPin,
  departamentos: Layers,
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  RRHH: 'Recursos Humanos',
  MANAGER: 'Manager',
  EMPLEADO: 'Empleado',
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const name = user?.employee?.fullName ?? user?.email ?? 'Usuario';
  const roleLabel = user?.employee?.jobTitle ?? (user ? ROLE_LABEL[user.role] : '');

  return (
    <aside className="w-[244px] shrink-0 h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--line-strong)]">
      {/* Marca */}
      <div className="px-5 pt-6 pb-1 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[var(--ink-primary)] flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-[var(--accent)] rounded-sm" />
        </div>
        <span className="font-serif font-medium text-[17px] tracking-[-0.02em]">humanX</span>
        <span className="mono text-[10px] text-[var(--ink-tertiary)] ml-auto">RRHH</span>
      </div>
      <div className="px-5 pb-3 pl-[52px] -mt-1 text-[11px] text-[var(--ink-tertiary)]">Core de personas</div>

      {/* Navegación (desde nav.ts) */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.filter((section) => !('hidden' in section && section.hidden)).map((section) => (
          <div key={section.section}>
            <div className="px-3 pt-4 pb-1.5 mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
              {section.section}
            </div>
            {section.items.map((item) => {
              const Icon = ICONS[item.key];
              const soon = 'soon' in item && item.soon;
              const tag = 'tag' in item ? item.tag : undefined;

              if (soon) {
                return (
                  <div
                    key={item.key}
                    title="Próximamente"
                    aria-disabled="true"
                    className="relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-medium text-[var(--ink-tertiary)] cursor-not-allowed select-none"
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="flex-1">{item.label}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-tertiary)]/40" />
                  </div>
                );
              }

              return (
                <NavLink
                  key={item.key}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
                      isActive
                        ? 'font-semibold bg-[var(--bg-surface)] text-[var(--ink-primary)] shadow-[0_1px_2px_rgba(10,10,10,0.05)]'
                        : 'font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--ink-primary)]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--accent)] rounded-r" />
                      )}
                      {Icon && <Icon className="w-4 h-4" />}
                      <span className="flex-1">{item.label}</span>
                      {tag && (
                        <Badge variant="accent" className="!h-4 !px-1.5 !text-[9px]">
                          {tag}
                        </Badge>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Usuario */}
      <div className="border-t border-[var(--line-strong)] p-4 flex items-center gap-3">
        <Avatar name={name} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold leading-tight truncate">{name}</div>
          <div className="mono text-[10px] text-[var(--ink-tertiary)] truncate">{roleLabel}</div>
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="p-1.5 rounded-md hover:bg-[var(--bg-sidebar-hover)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
