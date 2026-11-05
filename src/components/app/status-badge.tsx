import { Badge } from '@/components/ui/badge';
import type { ImpactLevel } from '@/lib/domain/types';
import type { PlayerStatus } from '@/lib/domain/views';

const PLAYER: Record<PlayerStatus, { label: string; tone: 'alert' | 'alert-soft' | 'watch' | 'ok' | 'offline' }> = {
  alert: { label: 'Alert', tone: 'alert' },
  eval: { label: 'Eval', tone: 'alert-soft' },
  out: { label: 'Out', tone: 'alert-soft' },
  watch: { label: 'Watch', tone: 'watch' },
  ok: { label: 'OK', tone: 'ok' },
  offline: { label: 'Offline', tone: 'offline' },
};

export function PlayerStatusBadge({ status }: { status: PlayerStatus }) {
  const s = PLAYER[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const LEVEL: Record<ImpactLevel, { label: string; tone: 'alert' | 'watch' | 'ok' }> = {
  alert: { label: 'Alert', tone: 'alert' },
  watch: { label: 'Watch', tone: 'watch' },
  logged: { label: 'Logged', tone: 'ok' },
};

export function ImpactLevelBadge({ level, excluded }: { level: ImpactLevel; excluded?: boolean }) {
  if (excluded) return <Badge tone="neutral">Excluded</Badge>;
  const s = LEVEL[level];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
