'use client';

import { useState } from 'react';
import { ImpactLevelBadge } from '@/components/app/status-badge';
import { Card } from '@/components/ui/card';
import { periodLabel } from '@/lib/domain/clock';
import type { Impact, Player } from '@/lib/domain/types';
import { playerShortName } from '@/lib/domain/views';
import { cn } from '@/lib/utils';

export function LiveFeed({
  impacts,
  players,
  onSelect,
}: {
  impacts: Impact[];
  players: Map<string, Player>;
  onSelect: (playerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = expanded ? impacts : impacts.slice(0, 7);
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">Live impact feed</h2>
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>
      {impacts.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Waiting for the first impact…</p>
      ) : (
        <ul className={cn('divide-y', expanded && 'max-h-[420px] overflow-y-auto pr-1')}>
          {rows.map((impact) => {
            const player = players.get(impact.playerId);
            return (
              <li key={impact.id}>
                <button
                  type="button"
                  onClick={() => onSelect(impact.playerId)}
                  className="grid w-full grid-cols-[52px_1fr_auto_76px] items-center gap-2 py-2.5 text-left text-[15px] hover:bg-muted/60"
                >
                  <span className="tabular text-sm text-muted-foreground" title={impact.period ? periodLabel(impact.period) : undefined}>
                    {impact.clockLabel}
                  </span>
                  <span className="truncate font-bold">
                    #{player?.number} {player ? playerShortName(player) : impact.sensorId}
                  </span>
                  <span className="tabular text-right">{Math.round(impact.linearG)} g</span>
                  <span className="flex justify-end">
                    <ImpactLevelBadge level={impact.level} excluded={impact.evaluation?.outcome === 'excluded'} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {impacts.length > 7 ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-2 text-sm font-bold text-info hover:underline">
          {expanded ? 'Show fewer' : `Show all ${impacts.length}`}
        </button>
      ) : null}
    </Card>
  );
}
