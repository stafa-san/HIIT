'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppFooter } from '@/components/app/app-footer';
import { AppHeader } from '@/components/app/app-header';
import { DataGate } from '@/components/app/data-gate';
import type { Snapshot } from '@/lib/domain/types';
import {
  bannerAlert,
  dashboardStats,
  indexById,
  liveSession,
  openAlerts,
  playerSessionDetail,
  rosterEntries,
  sessionImpacts,
} from '@/lib/domain/views';
import { useAlertNotifier } from '@/hooks/use-alert-notifier';
import { useNow } from '@/hooks/use-now';
import { AlertBanner, AlertStrip } from './alert-banner';
import { LiveFeed } from './live-feed';
import { PlayerPanel } from './player-panel';
import { Roster } from './roster';
import { StatTiles } from './stat-tiles';

export function Dashboard() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DataGate>{(snapshot) => <DashboardView snapshot={snapshot} />}</DataGate>
    </div>
  );
}

function DashboardView({ snapshot }: { snapshot: Snapshot }) {
  const params = useSearchParams();
  const now = useNow(15_000);
  const [selectedId, setSelectedId] = useState<string | null>(params.get('player'));

  const roster = useMemo(() => rosterEntries(snapshot), [snapshot]);
  const stats = useMemo(() => dashboardStats(snapshot, roster), [snapshot, roster]);
  const banner = useMemo(() => bannerAlert(snapshot), [snapshot]);
  const open = useMemo(() => openAlerts(snapshot), [snapshot]);
  const session = liveSession(snapshot);
  const feed = useMemo(() => sessionImpacts(snapshot, session?.id), [snapshot, session?.id]);
  const players = useMemo(() => indexById(snapshot.players), [snapshot.players]);

  // Default selection: the alert on the banner, else any open alert, else the latest hit.
  const fallback = banner?.playerId ?? open[0]?.playerId ?? feed[0]?.playerId ?? roster[0]?.player.id ?? null;
  const activeId = selectedId && players.has(selectedId) ? selectedId : fallback;
  const detail = useMemo(() => (activeId ? playerSessionDetail(snapshot, activeId, now) : null), [snapshot, activeId, now]);

  // Jump to a player when a new alert lands.
  const onAlert = useCallback((impact: { playerId: string }) => setSelectedId(impact.playerId), []);
  useAlertNotifier(onAlert, '/');

  useEffect(() => {
    const p = params.get('player');
    if (p) setSelectedId(p);
  }, [params]);

  const unbannered = open.filter((a) => a.id !== banner?.id);

  return (
    <>
      <AppHeader snapshot={snapshot} stats={stats} />
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          {banner ? (
            <AlertBanner snapshot={snapshot} alert={banner} extra={Math.max(0, open.filter((a) => a.evaluation?.acknowledgedAt === null).length - 1)} onSelect={setSelectedId} />
          ) : (
            <AlertStrip snapshot={snapshot} pending={unbannered} onSelect={setSelectedId} monitoring={stats.helmetsConnected} />
          )}
          <StatTiles stats={stats} alertThresholdG={snapshot.team.alertThresholdG} />
          {!session ? (
            <div className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
              No session is live. Start a game or practice from the header — or just send an impact from a sensor and a practice session opens automatically.
            </div>
          ) : null}
          <Roster entries={roster} selectedId={activeId} onSelect={setSelectedId} />
        </div>
        <aside className="flex min-w-0 flex-col gap-5">
          <PlayerPanel snapshot={snapshot} detail={detail} />
          <LiveFeed impacts={feed} players={players} onSelect={setSelectedId} />
        </aside>
      </main>
      <AppFooter />
    </>
  );
}
