import { Link } from 'react-router-dom';
import { Avatar, Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { useEmployeeKpis } from '../employees/useEmployees';
import { useSociedades, usePaises } from '../estructura/useEstructura';
import { useAlertas, TIPO_ALERTA_LABEL } from '../agenda/useAgenda';
import { useAnotaciones } from '../anotaciones/useAnotaciones';
import { formatDate } from '../../lib/format';

export function InicioPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'RRHH';
  const name = user?.employee?.fullName?.split(' ')[0] ?? '';

  const { data: kpis } = useEmployeeKpis();
  const { data: sociedades } = useSociedades();
  const { data: paises } = usePaises();
  const { data: alertas } = useAlertas();
  const { data: anotaciones } = useAnotaciones({ estado: 'PENDIENTE' }, canManage);

  const plantilla = kpis?.plantilla ?? 0;
  const externos = kpis?.externos ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow={`Hola, ${name}`} title="Inicio" subtitle="El pulso de tu día en el grupo." />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Plantilla / Externos</div>
          <div className="mono text-[28px] font-bold leading-none">
            {plantilla} <span className="text-[var(--ink-tertiary)]">/</span> {externos}
          </div>
          <div className="text-[11px] text-[var(--ink-tertiary)]">{kpis?.total ?? 0} personas en total</div>
        </div>
        <div className="stat-card">
          <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Sociedades · Países</div>
          <div className="mono text-[28px] font-bold leading-none">
            {(sociedades ?? []).length} <span className="text-[var(--ink-tertiary)]">·</span> {(paises ?? []).length}
          </div>
          <div className="text-[11px] text-[var(--ink-tertiary)]">grupo wowinX</div>
        </div>
        <div className="stat-card">
          <div className="text-[12px] font-medium text-[var(--ink-secondary)]">Alertas activas</div>
          <div className="mono text-[28px] font-bold leading-none">{(alertas ?? []).length}</div>
          <div className="text-[11px] text-[var(--ink-tertiary)]">fin de prueba y vencimientos, próximas 6 semanas</div>
        </div>
      </div>

      <div className={`grid ${canManage ? 'grid-cols-2' : 'grid-cols-1'} gap-5`}>
        <Card padding="p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
            <h3 className="font-serif text-[14px] font-medium">Alertas próximas</h3>
            <Link to="/agenda" className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline">
              Ver agenda →
            </Link>
          </div>
          <div className="px-5">
            {alertas && alertas.length > 0 ? (
              alertas.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-3 border-b border-[var(--line-subtle)] last:border-0">
                  <Avatar name={a.empleado.fullName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">{a.empleado.fullName}</div>
                    <div className="text-[11px] text-[var(--ink-tertiary)]">{TIPO_ALERTA_LABEL[a.tipo]}</div>
                  </div>
                  <span className="mono text-[11px] text-[var(--ink-secondary)] shrink-0">
                    {a.diasRestantes === 0 ? 'Hoy' : a.diasRestantes > 0 ? `en ${a.diasRestantes} días` : `hace ${-a.diasRestantes} días`}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[var(--ink-tertiary)] py-4">Sin alertas en las próximas 6 semanas.</p>
            )}
          </div>
        </Card>

        {canManage && (
          <Card padding="p-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)]">
              <h3 className="font-serif text-[14px] font-medium">Últimas anotaciones</h3>
              <Link to="/anotaciones" className="text-[12px] font-medium text-[var(--accent-ink)] hover:underline">
                Ver memoria →
              </Link>
            </div>
            <div className="px-5">
              {anotaciones && anotaciones.length > 0 ? (
                anotaciones.slice(0, 6).map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-3 border-b border-[var(--line-subtle)] last:border-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.categoria?.color ?? 'var(--ink-tertiary)' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium truncate">{a.empleado.fullName}</div>
                      <div className="text-[11px] text-[var(--ink-tertiary)] truncate">{a.texto}</div>
                    </div>
                    <span className="mono text-[11px] text-[var(--ink-tertiary)] shrink-0">{formatDate(a.fecha)}</span>
                  </div>
                ))
              ) : (
                <p className="text-[13px] text-[var(--ink-tertiary)] py-4">Sin anotaciones pendientes.</p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
