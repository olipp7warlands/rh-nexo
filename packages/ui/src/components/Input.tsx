import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}
const base = 'w-full h-9 px-3 bg-[var(--bg-surface)] border border-[var(--line-strong)] rounded-md text-[13px] text-[var(--ink-primary)] placeholder:text-[var(--ink-tertiary)] hover:border-[var(--ink-tertiary)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none transition-all';

// forwardRef: imprescindible para integrarse con React Hook Form (register()).
export const Input = forwardRef<HTMLInputElement, Props>(function Input({ icon, className, ...rest }, ref) {
  if (icon) {
    return (
      <div className={cn('relative', className)}>
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] [&_svg]:w-4 [&_svg]:h-4 pointer-events-none">{icon}</span>
        <input ref={ref} className={cn(base, 'pl-10')} {...rest} />
      </div>
    );
  }
  return <input ref={ref} className={cn(base, className)} {...rest} />;
});
