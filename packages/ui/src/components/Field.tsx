import type { ReactNode } from 'react';
import { cn } from '../cn';

export function Field({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[11px] uppercase tracking-wider text-[var(--ink-tertiary)] font-medium">{label}</dt>
      <dd className={cn('text-[13px] text-[var(--ink-primary)]', mono && 'mono')}>{value}</dd>
    </div>
  );
}
