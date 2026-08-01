import { useEffect, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  Euro,
  FileSignature,
  FileText,
  FolderKanban,
  HeartHandshake,
  Home,
  Languages,
  Layers,
  LogOut,
  MapPin,
  Network,
  Plane,
  Rocket,
  Settings,
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
  proyectos: FolderKanban,
  'tipos-contrato': FileSignature,
  jornadas: CalendarClock,
  'relaciones-emergencia': HeartHandshake,
  idiomas: Languages,
  configuracion: Settings,
};

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrador',
  RRHH: 'Recursos Humanos',
  MANAGER: 'Manager',
  EMPLEADO: 'Empleado',
};

// Item de menú con acordeón (p. ej. "Configuración Información"). Aparte en su propio
// componente porque necesita su propio useRef/useEffect para el auto-scroll al desplegarse —
// los hooks no pueden vivir dentro del .map() de Sidebar.
function AccordionNavGroup({
  label,
  path,
  subItems,
  Icon,
  isOnGroupPage,
  isExpanded,
  onToggle,
}: {
  label: string;
  path: string;
  subItems: readonly { key: string; label: string; path: string }[];
  Icon?: ComponentType<{ className?: string }>;
  isOnGroupPage: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Al desplegarse, hace scroll para que los sub-elementos queden visibles sin que el usuario
  // tenga que desplazarse a mano dentro del <nav> (que tiene su propio scroll interno).
  useEffect(() => {
    if (isExpanded) {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isExpanded]);

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'relative w-full flex items-center gap-3 px-3 py-2 rounded-md text-[13px] transition-colors',
          isOnGroupPage
            ? 'font-semibold bg-[var(--bg-surface)] text-[var(--ink-primary)] shadow-[0_1px_2px_rgba(10,10,10,0.05)]'
            : 'font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--ink-primary)]',
        )}
      >
        {isOnGroupPage && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-[var(--accent)] rounded-r" />
        )}
        {Icon && <Icon className="w-4 h-4" />}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-180')} />
      </button>
      {isExpanded && (
        <div ref={listRef} className="ml-4 pl-3 border-l border-[var(--line-strong)] flex flex-col gap-0.5 mt-0.5 mb-1">
          {subItems.map((child) => (
            <NavLink
              key={child.key}
              to={child.path}
              className={({ isActive }) =>
                cn(
                  'block px-3 py-1.5 rounded-md text-[12.5px] transition-colors',
                  isActive
                    ? 'font-semibold text-[var(--ink-primary)] bg-[var(--bg-surface)]'
                    : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-sidebar-hover)] hover:text-[var(--ink-primary)]',
                )
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const name = user?.employee?.fullName ?? user?.email ?? 'Usuario';
  const roleLabel = user?.employee?.jobTitle ?? (user ? ROLE_LABEL[user.role] : '');

  // Grupos acordeón (items con `children`, p. ej. "Configuración Información"): expandidos de
  // entrada si ya se está navegando dentro de su ruta AL MONTAR (una vez, vía el inicializador
  // perezoso de useState) — a partir de ahí el único que manda es el toggle manual. Antes
  // `isExpanded` también comprobaba `isOnGroupPage` en cada render, lo que forzaba el grupo
  // siempre abierto mientras se estuviera en /configuracion/* y hacía el toggle inservible ahí.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const s of NAV) {
      for (const item of s.items) {
        if ('children' in item && item.children && location.pathname.startsWith(item.path)) {
          initial.add(item.key);
        }
      }
    }
    return initial;
  });
  const toggleGroup = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
          <div key={section.section || 'sin-titulo'}>
            {section.section && (
              <div className="px-3 pt-4 pb-1.5 mono text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
                {section.section}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = ICONS[item.key];
              const soon = 'soon' in item && item.soon;
              const tag = 'tag' in item ? item.tag : undefined;
              const children = 'children' in item ? item.children : undefined;

              if (children) {
                const isOnGroupPage = location.pathname.startsWith(item.path);
                const isExpanded = expandedGroups.has(item.key);
                return (
                  <AccordionNavGroup
                    key={item.key}
                    label={item.label}
                    path={item.path}
                    subItems={children}
                    Icon={Icon}
                    isOnGroupPage={isOnGroupPage}
                    isExpanded={isExpanded}
                    onToggle={() => {
                      toggleGroup(item.key);
                      // Solo navega si aún no se está dentro de la sección — si ya se está
                      // viendo una pestaña concreta (p. ej. Jornadas), cerrar/abrir el
                      // acordeón no debe hacerte perder la pestaña actual.
                      if (!isOnGroupPage) navigate(item.path);
                    }}
                  />
                );
              }

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
