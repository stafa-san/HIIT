'use client';

import { useMemo, useState } from 'react';
import { PlayerStatusBadge } from '@/components/app/status-badge';
import { isFlagged, playerShortName, sortRoster, type RosterEntry, type RosterSort } from '@/lib/domain/views';
import { cn } from '@/lib/utils';

const SORTS: Array<{ id: RosterSort; label: string }> = [
  { id: 'priority', label: 'priority' },
  { id: 'last-impact', label: 'last impact' },
  { id: 'hits', label: 'hits' },
  { id: 'number', label: 'jersey #' },
];

export function Roster({
  entries,
  selectedId,
  onSelect,
}: {
  entries: RosterEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortIdx, setSortIdx] = useState(0);
  const sort = SORTS[sortIdx];

  const visible = useMemo(() => {
    const list = flaggedOnly ? entries.filter((e) => isFlagged(e.status)) : entries;
    return sortRoster(list, sort.id);
  }, [entries, flaggedOnly, sort.id]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">On-field roster</h2>
        <div className="flex flex-wrap gap-2">
          <Chip active={!flaggedOnly} onClick={() => setFlaggedOnly(false)}>
            All players
          </Chip>
          <Chip active={flaggedOnly} onClick={() => setFlaggedOnly(true)}>
            Flagged only
          </Chip>
          <Chip onClick={() => setSortIdx((i) => (i + 1) % SORTS.length)}>Sort: {sort.label}</Chip>
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">No flagged players right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-3 min-[1200px]:grid-cols-4">
          {visible.map((entry) => (
            <PlayerCard key={entry.player.id} entry={entry} selected={entry.player.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-11 rounded-full border px-4 text-sm font-semibold transition',
        active ? 'border-navy bg-navy text-white' : 'border-input bg-card hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}

function PlayerCard({ entry, selected, onSelect }: { entry: RosterEntry; selected: boolean; onSelect: (id: string) => void }) {
  const { player, status, lastImpact, hits } = entry;
  const offline = entry.sensor.connection === 'offline';
  return (
    <button
      type="button"
      onClick={() => onSelect(player.id)}
      aria-pressed={selected}
      className={cn(
        'group rounded-2xl border bg-card p-4 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        status === 'alert' && 'border-2 border-alert shadow-[0_0_0_4px_hsl(var(--alert)/0.12)]',
        status === 'eval' && 'border-2 border-alert/60',
        status === 'watch' && 'border-2 border-watch',
        status === 'out' && 'bg-muted/60',
        offline && status !== 'alert' && status !== 'watch' && 'border-dashed border-input',
        selected && 'ring-2 ring-navy ring-offset-2 ring-offset-background',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="tabular text-[28px] font-bold leading-none">#{player.number}</span>
        <PlayerStatusBadge status={status} />
      </div>
      <div className="mt-2 truncate text-[15px]">
        <span className="font-bold">{playerShortName(player)}</span>
        <span className="text-muted-foreground"> · {player.position}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
        {status === 'out' && player.rtp ? (
          <span className="font-semibold text-alert">RTP step {player.rtp.currentStep} of 6</span>
        ) : (
          <span>
            Last: <span className="font-bold text-foreground">{offline && !lastImpact ? '—' : lastImpact ? `${Math.round(lastImpact.linearG)} g` : '—'}</span>
          </span>
        )}
        <span>
          Hits: <span className="font-bold text-foreground">{offline && hits === 0 ? '—' : hits}</span>
        </span>
      </div>
    </button>
  );
}
