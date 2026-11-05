import type { DashboardStats } from '@/lib/domain/views';
import { cn } from '@/lib/utils';

export function StatTiles({ stats, alertThresholdG }: { stats: DashboardStats; alertThresholdG: number }) {
  const tiles = [
    { label: 'Impacts this session', value: stats.impacts, tone: 'text-foreground' },
    { label: `Alerts (≥ ${alertThresholdG} g)`, value: stats.alerts, tone: stats.alerts ? 'text-alert' : 'text-foreground' },
    { label: 'Watch list', value: stats.watchList, tone: stats.watchList ? 'text-watch-foreground' : 'text-foreground' },
    { label: 'Sensors offline', value: stats.sensorsOffline, tone: 'text-muted-foreground' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border bg-card px-5 py-4">
          <div className="text-sm text-muted-foreground">{t.label}</div>
          <div className={cn('tabular mt-1 text-[32px] font-bold leading-none', t.tone)}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}
