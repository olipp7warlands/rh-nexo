import { cn } from '../cn';
/**
 * Genérico: recibe nombre y color del departamento (desacoplado del dominio). El `color` de
 * BD ya no se pinta — dirección Editorial monocroma, el único color permitido en la app son
 * las categorías de Anotaciones. Se mantiene el prop por compatibilidad con quien lo llama.
 */
export function DeptChip({ name, className }: { name: string; color?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 h-6 px-2 rounded text-[11px] font-medium bg-[var(--bg-subtle)] text-[var(--ink-secondary)]',
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-disabled)]" />
      {name}
    </span>
  );
}
