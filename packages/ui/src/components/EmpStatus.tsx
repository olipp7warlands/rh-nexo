import { Badge } from './Badge';

const MAP = {
  ACTIVO: { v: 'success', t: 'Activo' },
  ONBOARDING: { v: 'info', t: 'Onboarding' },
  AUSENTE: { v: 'warning', t: 'Ausente' },
  BAJA: { v: 'neutral', t: 'Baja' },
} as const;

export function EmpStatus({ status }: { status: keyof typeof MAP }) {
  const x = MAP[status];
  if (!x) return null;
  return <Badge variant={x.v} dot>{x.t}</Badge>;
}
