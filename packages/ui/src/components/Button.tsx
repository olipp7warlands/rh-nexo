import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const sizes: Record<Size, string> = {
  sm: 'h-7 px-3 text-xs',
  md: 'h-9 px-4 text-[13px]',
  lg: 'h-11 px-5 text-sm',
};
const variants: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] active:bg-[var(--accent-pressed)] border border-transparent',
  secondary: 'bg-[var(--bg-surface)] text-[var(--ink-primary)] border border-[var(--line-strong)] hover:bg-[var(--bg-subtle)] hover:border-[var(--ink-tertiary)]',
  ghost: 'bg-transparent text-[var(--ink-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--ink-primary)] border border-transparent',
  danger: 'bg-[var(--danger)] text-white hover:bg-red-700 border border-transparent',
  dark: 'bg-[var(--ink-primary)] text-white hover:bg-[#1A2027] border border-transparent',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', icon, iconRight, children, className, ...rest }: Props) {
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all whitespace-nowrap disabled:opacity-50 disabled:pointer-events-none', sizes[size], variants[variant], className)}
      {...rest}
    >
      {icon && <span className="-ml-0.5 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
      {children}
      {iconRight && <span className="-mr-0.5 [&_svg]:w-4 [&_svg]:h-4">{iconRight}</span>}
    </button>
  );
}
