import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-8">
      <div>
        {eyebrow && <div className="text-[11px] font-medium tracking-[0.08em] uppercase text-[var(--ink-tertiary)] mb-1.5">{eyebrow}</div>}
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-tight">{title}</h1>
        {subtitle && <p className="text-[14px] text-[var(--ink-secondary)] mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
