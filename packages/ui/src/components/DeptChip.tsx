import { cn } from '../cn';
/** Genérico: recibe nombre y color del departamento (desacoplado del dominio). */
export function DeptChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium', className)} style={{ background: `${color}15`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}
