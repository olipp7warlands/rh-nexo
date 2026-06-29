import { PageHeader } from '@nucleo/ui';

/** Página puente para secciones que se construyen en fases posteriores (ver PLAN.md). */
export function PlaceholderPage({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <div className="max-w-[1400px] mx-auto px-10 py-10">
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Esta sección se construye en una fase posterior (ver PLAN.md)." />
      <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--bg-subtle)] p-12 text-center text-[13px] text-[var(--ink-tertiary)]">
        En construcción.
      </div>
    </div>
  );
}
