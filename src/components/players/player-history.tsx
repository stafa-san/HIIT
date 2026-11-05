'use client';

import { FileDown, Share2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { AppFooter } from '@/components/app/app-footer';
import { DataGate } from '@/components/app/data-gate';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { periodLabel } from '@/lib/domain/clock';
import { isRtpActive, RTP_STEPS } from '@/lib/domain/rtp';
import type { Player, Snapshot } from '@/lib/domain/types';
import { alertLog, openAlerts, playerName, seasonSummary, type AlertLogStatus } from '@/lib/domain/views';
import { positionName } from '@/lib/domain/positions';
import { useNow } from '@/hooks/use-now';
import { cn, formatDate } from '@/lib/utils';
import { RtpPanel } from './rtp-panel';
import { WeeklyImpactsChart } from './weekly-chart';

export function PlayerHistory() {
  const { playerId } = useParams<{ playerId: string }>();
  return (
    <div className="flex min-h-dvh flex-col">
      <DataGate>{(snapshot) => <HistoryView snapshot={snapshot} playerId={playerId} />}</DataGate>
    </div>
  );
}

const OUTCOME: Record<AlertLogStatus, { label: string; tone: 'alert' | 'neutral' | 'ok' | 'alert-soft' }> = {
  pending: { label: 'Pending', tone: 'alert' },
  evaluating: { label: 'Evaluating', tone: 'alert-soft' },
  protocol: { label: 'In protocol', tone: 'alert' },
  cleared: { label: 'Cleared', tone: 'ok' },
  excluded: { label: 'Excluded', tone: 'neutral' },
};

export function playerStatusPill(snapshot: Snapshot, player: Player): { label: string; tone: 'alert' | 'success' | 'neutral' | 'watch' } {
  if (player.rosterStatus !== 'active') return { label: player.note ?? 'Inactive', tone: 'neutral' };
  if (isRtpActive(player) && player.rtp) return { label: `Out · Return-to-play step ${player.rtp.currentStep} of 6`, tone: 'alert' };
  const open = openAlerts(snapshot).find((a) => a.playerId === player.id);
  if (open) return { label: open.evaluation?.status === 'evaluating' ? 'Under evaluation' : 'Alert · evaluation pending', tone: 'alert' };
  if (player.rtp?.completedAt) return { label: `Active · cleared ${formatDate(player.rtp.completedAt)}`, tone: 'success' };
  if (!player.sensorId) return { label: 'Active · no sensor', tone: 'watch' };
  return { label: 'Active', tone: 'success' };
}

function HistoryView({ snapshot, playerId }: { snapshot: Snapshot; playerId: string }) {
  const now = useNow(60_000);
  const player = snapshot.players.find((p) => p.id === playerId);
  const season = useMemo(() => (player ? seasonSummary(snapshot, player.id, now) : null), [snapshot, player, now]);
  const log = useMemo(() => (player ? alertLog(snapshot, player.id) : []), [snapshot, player]);

  if (!player || !season) {
    return (
      <>
        <PageHeader title="Player history" />
        <p className="p-10 text-center text-muted-foreground">Player not found.</p>
      </>
    );
  }

  const pill = playerStatusPill(snapshot, player);
  const triggering = player.rtp?.alertImpactId ? snapshot.impacts.find((i) => i.id === player.rtp!.alertImpactId) ?? null : null;

  const share = async () => {
    const lines = [
      `H.I.T.T. impact summary — #${player.number} ${playerName(player)} (${positionName(player.position)}, ${player.classYear})`,
      `Status: ${pill.label}`,
      `Season impacts: ${season.seasonImpacts} · Alert-level hits: ${season.alertHits} · Avg peak: ${season.avgPeakG ? Math.round(season.avgPeakG) : '—'} g`,
      ...log.slice(0, 5).map((e) => `• ${formatDate(e.impact.at)} ${e.session?.label ?? ''}: ${Math.round(e.impact.linearG)} g — ${OUTCOME[e.status].label}${e.note ? ` (${e.note})` : ''}`),
      player.rtp ? `Return-to-play: step ${player.rtp.currentStep} of 6 (${RTP_STEPS[player.rtp.currentStep - 1]?.title}); clearance ${player.rtp.clearance.status}` : '',
      window.location.href,
    ].filter(Boolean);
    const text = lines.join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: `H.I.T.T. — ${playerName(player)}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success('Summary copied — paste it into an email to the team physician');
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <>
      <PageHeader
        title="Player history"
        subtitle={`${snapshot.team.season} season · as of ${formatDate(now)}`}
        actions={
          <>
            <Button variant="outline-inverse" onClick={() => void share()}>
              <Share2 /> Share with physician
            </Button>
            <Button className="bg-white text-navy hover:bg-white/90" onClick={() => window.print()}>
              <FileDown /> Export PDF report
            </Button>
          </>
        }
      />
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 gap-5 px-4 py-5 sm:px-6">
        <Card className="flex flex-wrap items-center gap-5 p-5">
          <div className="flex items-center gap-4">
            <span className="tabular flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white">
              {player.number}
            </span>
            <div>
              <h1 className="text-2xl font-bold">{playerName(player)}</h1>
              <div className="text-[15px] text-muted-foreground">
                {positionName(player.position)} · {player.classYear} · {player.sensorId ? `Sensor ${player.sensorId}` : 'No sensor'}
              </div>
              <span
                className={cn(
                  'mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold',
                  pill.tone === 'alert' && 'bg-alert text-white',
                  pill.tone === 'success' && 'bg-success-soft text-success',
                  pill.tone === 'neutral' && 'bg-muted text-muted-foreground',
                  pill.tone === 'watch' && 'bg-watch-soft text-watch-foreground',
                )}
              >
                {pill.label}
              </span>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Season impacts" value={season.seasonImpacts.toLocaleString()} />
            <Stat label="Alert-level hits" value={String(season.alertHits)} tone={season.alertHits ? 'alert' : undefined} />
            <Stat label="Avg. peak per hit" value={season.avgPeakG ? `${Math.round(season.avgPeakG)} g` : '—'} />
            <Stat label="Sessions logged" value={String(season.sessionsLogged)} />
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <Card className="p-5">
              <WeeklyImpactsChart weeks={season.weekly} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-lg font-bold">Alert log</h2>
              {log.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No alert-level impacts this season.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[15px]">
                    <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-3 font-semibold">Date</th>
                        <th className="py-2 pr-3 font-semibold">Session</th>
                        <th className="py-2 pr-3 font-semibold">Peak</th>
                        <th className="py-2 font-semibold">Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {log.map((e) => (
                        <tr key={e.impact.id} className={cn(e.status === 'excluded' && 'text-muted-foreground')}>
                          <td className="whitespace-nowrap py-3 pr-3">{formatDate(e.impact.at)}</td>
                          <td className="py-3 pr-3">
                            {e.session?.label ?? '—'}
                            {e.impact.period ? <span className="text-xs text-muted-foreground"> · {periodLabel(e.impact.period)} {e.impact.clockLabel}</span> : null}
                          </td>
                          <td className="tabular py-3 pr-3 font-bold">{Math.round(e.impact.linearG)} g</td>
                          <td className="py-3">
                            <span className="flex flex-wrap items-center gap-2">
                              <Badge tone={OUTCOME[e.status].tone} casing="normal">
                                {OUTCOME[e.status].label}
                              </Badge>
                              <span className="text-sm text-muted-foreground">{e.note}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
          <RtpPanel player={player} team={snapshot.team} triggeringAlert={triggering} now={now} />
        </div>
      </main>
      <AppFooter note="H.I.T.T. records protocol steps. Return-to-play decisions are made by the athletic trainer and a licensed healthcare provider." />
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="rounded-xl bg-muted px-4 py-3">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn('tabular text-[28px] font-bold leading-tight', tone === 'alert' && 'text-alert')}>{value}</div>
    </div>
  );
}
