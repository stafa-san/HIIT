'use client';

import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { actions } from '@/lib/actions';
import type { Impact, Snapshot } from '@/lib/domain/types';
import { alertOrdinal, playerName, playerShortName } from '@/lib/domain/views';
import { useNow } from '@/hooks/use-now';
import { formatAgo, formatNumber, ordinal } from '@/lib/utils';

/** The red "HIGH-MAGNITUDE IMPACT" banner — newest unacknowledged alert. */
export function AlertBanner({
  snapshot,
  alert,
  extra,
  onSelect,
}: {
  snapshot: Snapshot;
  alert: Impact;
  extra: number;
  onSelect: (playerId: string) => void;
}) {
  const now = useNow(1000);
  const player = snapshot.players.find((p) => p.id === alert.playerId);
  const nth = alertOrdinal(snapshot, alert);
  if (!player) return null;

  return (
    <section
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border-2 border-alert bg-card p-5 pl-7 animate-flash-in sm:flex-row sm:items-center"
      role="alert"
    >
      <span className="absolute inset-y-0 left-0 w-2.5 bg-alert" />
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-alert/30 animate-pulse-ring" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-alert">
          <AlertTriangle className="h-8 w-8 text-white" strokeWidth={2.25} />
        </span>
      </div>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(player.id)}>
        <div className="eyebrow text-alert">
          High-magnitude impact · <span className="tabular">{formatAgo(now - alert.at)}</span> ago
          {extra > 0 ? <span className="ml-2 rounded-full bg-alert px-2 py-0.5 text-white">+{extra} more</span> : null}
        </div>
        <div className="mt-1 text-2xl font-bold sm:text-[28px]">
          #{player.number} {playerName(player)} · {player.position}
        </div>
        <div className="mt-1 text-[15px] text-muted-foreground">
          {Math.round(alert.linearG)} g linear
          {alert.rotationalRadS2 ? ` · ${formatNumber(alert.rotationalRadS2)} rad/s² rotational` : ''}
          {nth ? ` · ${ordinal(nth)} alert-level hit this season` : ''}
        </div>
      </button>
      <div className="flex shrink-0 flex-col gap-2 sm:w-48">
        <Button variant="alert" size="lg" onClick={() => void actions.pull(alert.id).then(() => onSelect(player.id))}>
          Pull for evaluation
        </Button>
        <Button variant="outline" size="lg" onClick={() => void actions.acknowledge(alert.id)}>
          Mark reviewed
        </Button>
      </div>
    </section>
  );
}

/** Shown in place of the banner when nothing needs immediate attention. */
export function AlertStrip({
  snapshot,
  pending,
  onSelect,
  monitoring,
}: {
  snapshot: Snapshot;
  pending: Impact[];
  onSelect: (playerId: string) => void;
  monitoring: number;
}) {
  if (pending.length === 0) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4">
        <CheckCircle2 className="h-6 w-6 text-success" />
        <div>
          <div className="font-bold">No open alerts</div>
          <div className="text-sm text-muted-foreground">Monitoring {monitoring} helmets in real time.</div>
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border-2 border-alert/40 bg-alert-soft px-5 py-3">
      <div className="eyebrow mb-2 text-alert">
        {pending.length} alert{pending.length === 1 ? '' : 's'} awaiting an outcome
      </div>
      <div className="flex flex-wrap gap-2">
        {pending.map((a) => {
          const p = snapshot.players.find((x) => x.id === a.playerId);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => p && onSelect(p.id)}
              className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm font-bold shadow-sm ring-1 ring-alert/30 hover:ring-alert"
            >
              #{p?.number} {p ? playerShortName(p) : a.sensorId} · {Math.round(a.linearG)} g
              <span className="font-normal text-muted-foreground">{a.evaluation?.status === 'evaluating' ? 'evaluating' : 'reviewed'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
