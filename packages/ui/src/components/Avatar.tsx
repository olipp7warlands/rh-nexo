import { cn } from '../cn';

// Editorial (monocromo): grises oscuros, todos con contraste suficiente para texto blanco.
const COLORS = ['#0A0A0A', '#1A1A1A', '#2B2B2B', '#3D3D3D', '#333333', '#4A4A4A', '#5C5C5C', '#6B6B6B'];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length]!;
}
export const initials = (name: string) => name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase();

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const sizes: Record<Size, string> = {
  xs: 'w-6 h-6 text-[10px]', sm: 'w-7 h-7 text-[11px]', md: 'w-9 h-9 text-[13px]', lg: 'w-12 h-12 text-base', xl: 'w-20 h-20 text-2xl',
};

export function Avatar({ name, size = 'md', className }: { name: string; size?: Size; className?: string }) {
  return (
    <div className={cn('rounded-full flex items-center justify-center font-medium text-white flex-shrink-0', sizes[size], className)} style={{ background: avatarColor(name) }}>
      {initials(name)}
    </div>
  );
}
