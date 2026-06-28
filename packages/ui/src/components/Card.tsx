import type { ReactNode } from 'react';
import { cn } from '../cn';

export function Card({ children, className, padding = 'p-6' }: { children: ReactNode; className?: string; padding?: string }) {
  return <div className={cn('bg-[var(--bg-surface)] border border-[var(--line)] rounded-xl', padding, className)}>{children}</div>;
}
