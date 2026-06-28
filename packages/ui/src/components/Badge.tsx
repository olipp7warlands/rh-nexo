import type { ReactNode } from 'react';
import { cn } from '../cn';

type Variant = 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'accent';
const variants: Record<Variant, string> = {
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  neutral: 'bg-gray-100 text-gray-600',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
};

export function Badge({ variant = 'neutral', dot = false, children, className }: { variant?: Variant; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-[22px] px-2.5 text-[11px] font-medium rounded-full leading-none', variants[variant], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
