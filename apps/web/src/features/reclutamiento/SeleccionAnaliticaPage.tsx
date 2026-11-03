import { Card, PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';
import { ProcesosAnalitica } from '../reports/ProcesosAnalitica';
import { SeleccionTabs } from './SeleccionTabs';

/** Pestaña «Analítica» de Selección (/seleccion/analitica): el mismo componente que Informes. */
export function SeleccionAnaliticaPage() {
  const { user } = useAuth();
  const canView = user?.role === 'ADMIN' || user?.role === 'RRHH';

  if (!canView) {
    return (
      <div className="max-w-[1400px] mx-auto px-10 py-10">
        <PageHeader eyebrow="Talento" title="Selección" />
        <Card>
          <p className="text-[13px] text-[var(--ink-secondary)]">La analítica de procesos solo está disponible para RRHH y Administración.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow="Talento" title="Selección" subtitle="Analítica de procesos: ofertas por año, tiempos de cierre y embudo." />
      <SeleccionTabs />
      <ProcesosAnalitica />
    </div>
  );
}
