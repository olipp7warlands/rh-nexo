import { cn } from '../cn';

export function KPICard({ label, value, meta, primary = false, delta }: {
  label: string; value: string; meta?: string; primary?: boolean;
  delta?: { positive: boolean; text: string };
}) {
  return (
    <div className={cn('stat-card', primary && 'primary')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value mono-tabular">{value}</div>
      <div className="stat-meta">
        {delta && <span className={cn('stat-delta', delta.positive ? 'positive' : 'negative')}>{delta.positive ? '↑' : '↓'} {delta.text}</span>}
        {meta && <span className={delta ? 'ml-2' : ''}>{meta}</span>}
      </div>
    </div>
  );
}
