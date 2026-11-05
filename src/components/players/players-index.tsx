'use client';

import { Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AppFooter } from '@/components/app/app-footer';
import { DataGate } from '@/components/app/data-gate';
import { PageHeader } from '@/components/app/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { isRtpActive } from '@/lib/domain/rtp';
import type { Snapshot } from '@/lib/domain/types';
import { playerName, seasonSummary } from '@/lib/domain/views';
import { cn } from '@/lib/utils';
import { playerStatusPill } from './player-history';

type Filter = 'active' | 'protocol' | 'no-sensor' | 'inactive';

export function PlayersIndex() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DataGate>{(snapshot) => <PlayersView snapshot={snapshot} />}</DataGate>
    </div>
  );
}

function PlayersView({ snapshot }: { snapshot: Snapshot }) {
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const now = Date.now();

  const rows = useMemo(
    () =>
      snapshot.players
        .map((p) => ({ player: p, season: seasonSummary(snapshot, p.id, now), pill: playerStatusPill(snapshot, p) }))
        .sort((a, b) => a.player.number - b.player.number),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot],
  );
  const counts = {
    active: rows.filter((r) => r.player.rosterStatus === 'active').length,
    protocol: rows.filter((r) => isRtpActive(r.player)).length,
    'no-sensor': rows.filter((r) => r.player.rosterStatus === 'active' && !r.player.sensorId).length,
    inactive: rows.filter((r) => r.player.rosterStatus !== 'active').length,
  };
  const visible = rows.filter(({ player }) => {
    if (filter === 'active' && player.rosterStatus !== 'active') return false;
    if (filter === 'protocol' && !isRtpActive(player)) return false;
    if (filter === 'no-sensor' && (player.rosterStatus !== 'active' || player.sensorId)) return false;
    if (filter === 'inactive' && player.rosterStatus === 'active') return false;
    const q = query.trim().toLowerCase();
    return !q || playerName(player).toLowerCase().includes(q) || String(player.number) === q.replace('#', '') || player.position.toLowerCase() === q;
  });

  const labels: Record<Filter, string> = { active: 'Active roster', protocol: 'In protocol', 'no-sensor': 'No sensor', inactive: 'Inactive' };

  return (
    <>
      <PageHeader title="Players" subtitle={`${snapshot.team.school} · ${snapshot.team.name} · ${snapshot.team.season} season`} />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-5">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" placeholder="Search name, #, or position" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(labels) as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn('h-10 rounded-full border px-4 text-sm font-semibold', filter === f ? 'border-navy bg-navy text-white' : 'bg-card hover:bg-muted')}
                >
                  {labels[f]} · {counts[f]}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[15px]">
              <thead className="border-y bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2.5 pl-5 font-semibold">#</th>
                  <th className="py-2.5 font-semibold">Player</th>
                  <th className="py-2.5 font-semibold">Sensor</th>
                  <th className="py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 text-right font-semibold">Season impacts</th>
                  <th className="py-2.5 text-right font-semibold">Alert hits</th>
                  <th className="py-2.5 pr-5 text-right font-semibold">Avg. peak</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map(({ player, season, pill }) => (
                  <tr key={player.id} className="relative hover:bg-muted/50">
                    <td className="tabular py-3 pl-5 font-bold">{player.number}</td>
                    <td className="py-3">
                      <Link href={`/players/${player.id}`} className="font-bold after:absolute after:inset-0 hover:underline">
                        {playerName(player)}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {player.position} · {player.classYear}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{player.sensorId ?? '—'}</td>
                    <td className="py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-bold',
                          pill.tone === 'alert' && 'bg-alert text-white',
                          pill.tone === 'success' && 'bg-success-soft text-success',
                          pill.tone === 'neutral' && 'bg-muted text-muted-foreground',
                          pill.tone === 'watch' && 'bg-watch-soft text-watch-foreground',
                        )}
                      >
                        {pill.label}
                      </span>
                    </td>
                    <td className="tabular py-3 text-right">{season.seasonImpacts.toLocaleString()}</td>
                    <td className={cn('tabular py-3 text-right', season.alertHits && 'font-bold text-alert')}>{season.alertHits}</td>
                    <td className="tabular py-3 pr-5 text-right">{season.avgPeakG ? `${Math.round(season.avgPeakG)} g` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No players match.</p> : null}
          </div>
        </Card>
      </main>
      <AppFooter />
    </>
  );
}
