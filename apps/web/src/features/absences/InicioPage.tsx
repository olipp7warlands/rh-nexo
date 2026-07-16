import { PageHeader } from '@nucleo/ui';
import { useAuth } from '../auth/AuthContext';

export function InicioPage() {
  const { user } = useAuth();
  const name = user?.employee?.fullName?.split(' ')[0] ?? '';

  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow={`Hola, ${name}`} title="Inicio" subtitle="El pulso de tu día en el grupo." />
      <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-subtle)] p-12 text-center text-[13px] text-[var(--ink-tertiary)]">
        El panel de Inicio se construye en una fase posterior, cuando fusione alertas de contrato, agenda y anotaciones
        (ver PLAN-humanX.md).
      </div>
    </div>
  );
}
