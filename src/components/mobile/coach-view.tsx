'use client';

import { AlertTriangle, Bell, BellRing, CheckCircle2, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataGate } from '@/components/app/data-gate';
import { HelmetGraphic } from '@/components/app/helmet';
import { Button } from '@/components/ui/button';
import { actions } from '@/lib/actions';
import { playAlertChime, primeAudio, requestNotifications } from '@/lib/alerting';
import { periodLabel, sessionClockLabel } from '@/lib/domain/clock';
import { positionName } from '@/lib/domain/positions';
import type { Impact, Snapshot } from '@/lib/domain/types';
import {
  alertOrdinal,
  dashboardStats,
  liveSession,
  openAlerts,
  playerName,
  playerShortName,
  rosterEntries,
  sessionImpacts,
} from '@/lib/domain/views';
import { useAlertNotifier } from '@/hooks/use-alert-notifier';
import { useNow } from '@/hooks/use-now';
import { cn, formatAgo, formatNumber, ordinal } from '@/lib/utils';

export function CoachView() {
  return (
    <div className="min-h-dvh bg-navy text-white">
      <DataGate tone="dark">{(snapshot) => <CoachScreen snapshot={snapshot} />}</DataGate>
    </div>
  );
}

function CoachScreen({ snapshot }: { snapshot: Snapshot }) {
  const now = useNow(1000);
  const alerts = useMemo(() => openAlerts(snapshot), [snapshot]);
  const [index, setIndex] = useState(0);
  useAlertNotifier(() => setIndex(0), '/m');
  useEffect(() => {
    if (index >= alerts.length) setIndex(0);
  }, [alerts.length, index]);

  const alert = alerts[index] ?? null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]" onPointerDown={primeAudio}>
      <header className="flex items-center justify-between py-3">
        <span className="text-xl font-bold tracking-wide">H.I.T.T.</span>
        <span className="tabular text-[15px] text-white/75">
          {alert ? (
            <>
              {alert.period ? `${periodLabel(alert.period)} · ` : ''}
              {alert.clockLabel} · {formatAgo(now - alert.at)} ago
            </>
          ) : (
            (() => {
              const s = liveSession(snapshot);
              return s ? sessionClockLabel(s, now) : 'No live session';
            })()
          )}
        </span>
      </header>
      {alert ? (
        <AlertScreen snapshot={snapshot} alert={alert} index={index} count={alerts.length} onIndex={setIndex} />
      ) : (
        <AllClear snapshot={snapshot} now={now} />
      )}
      <p className="mt-6 text-center text-xs leading-relaxed text-white/60">
        Flags impacts for evaluation by a qualified professional. Does not diagnose concussion.
      </p>
    </div>
  );
}

function AlertScreen({
  snapshot,
  alert,
  index,
  count,
  onIndex,
}: {
  snapshot: Snapshot;
  alert: Impact;
  index: number;
  count: number;
  onIndex: (i: number) => void;
}) {
  const [confirmFalse, setConfirmFalse] = useState(false);
  const player = snapshot.players.find((p) => p.id === alert.playerId);
  const live = liveSession(snapshot);
  const hits = sessionImpacts(snapshot, live?.id).filter((i) => i.playerId === alert.playerId).length;
  const nth = alertOrdinal(snapshot, alert);
  const over = Math.round(alert.linearG - snapshot.team.alertThresholdG);
  const evaluating = alert.evaluation?.status === 'evaluating';
  const ev = alert.evaluation;
  const checklistDone = ev ? [ev.checklist.removed, ev.checklist.assessed, ev.checklist.physicianNotified].filter(Boolean).length : 0;

  useEffect(() => setConfirmFalse(false), [alert.id]);
  if (!player) return null;

  return (
    <main className="flex flex-1 flex-col">
      {count > 1 ? (
        <div className="mb-2 flex items-center justify-center gap-3 text-sm text-white/80">
          <button type="button" aria-label="Previous alert" className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={index === 0} onClick={() => onIndex(index - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="tabular">
            Alert {index + 1} of {count}
          </span>
          <button type="button" aria-label="Next alert" className="rounded-full p-1.5 hover:bg-white/10 disabled:opacity-30" disabled={index === count - 1} onClick={() => onIndex(index + 1)}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col items-center text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          {!evaluating ? <span className="absolute inset-0 rounded-full bg-alert/40 animate-pulse-ring" /> : null}
          <span className="absolute inset-0 rounded-full bg-[hsl(353_45%_30%/0.45)]" />
          <span className={cn('relative flex h-20 w-20 items-center justify-center rounded-full', evaluating ? 'bg-watch' : 'bg-alert')}>
            <AlertTriangle className="h-10 w-10 text-white" strokeWidth={2.25} />
          </span>
        </div>
        <div className="eyebrow mt-4 text-[13px] text-[hsl(353_85%_82%)]">
          {evaluating ? 'Under evaluation' : 'High-magnitude impact'}
        </div>
        <h1 className="mt-2 text-[34px] font-bold leading-tight">
          #{player.number} {playerName(player)}
        </h1>
        <p className="mt-1 text-lg text-white/75">
          {positionName(player.position)} · {snapshot.team.name}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-navy-soft px-5 py-4">
          <div className="text-sm text-white/75">Peak linear</div>
          <div className="tabular text-[40px] font-bold leading-none">{Math.round(alert.linearG)} g</div>
        </div>
        <div className="rounded-2xl bg-navy-soft px-5 py-4">
          <div className="text-sm text-white/75">Rotational</div>
          <div className="tabular mt-1 text-[30px] font-bold leading-none">
            {alert.rotationalRadS2 ? formatNumber(alert.rotationalRadS2) : '—'}
            {alert.rotationalRadS2 ? <span className="ml-1.5 text-sm">rad/s²</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-5 rounded-2xl bg-navy-soft px-5 py-5">
        <HelmetGraphic tone="dark" alert className="h-20 w-24 shrink-0" />
        <div className="min-w-0">
          <div className="text-lg font-bold">{over >= 0 ? `${over} g over alert threshold` : `${-over} g under alert threshold`}</div>
          <div className="text-white/75">{hits} hits this session</div>
          {nth ? <div className="text-white/75">{ordinal(nth)} alert-level hit this season</div> : null}
        </div>
      </div>

      <div className="mt-auto grid gap-3 pt-8">
        {evaluating ? (
          <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3.5">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-[hsl(148_55%_60%)]" />
            <div>
              <div className="font-bold">Pulled for evaluation</div>
              <div className="text-sm text-white/70">Checklist {checklistDone} of 3 · outcome pending</div>
            </div>
          </div>
        ) : (
          <Button variant="alert" size="xl" className="h-16 text-xl" onClick={() => void actions.pull(alert.id)}>
            Pull for evaluation
          </Button>
        )}
        <Button asChild variant="outline-inverse" size="xl" className="h-14">
          <Link href={`/?player=${player.id}`}>Open sideline dashboard</Link>
        </Button>
        <button
          type="button"
          className={cn('mx-auto mt-1 py-2 text-[17px] underline underline-offset-4', confirmFalse ? 'font-bold text-[hsl(353_85%_82%)]' : 'text-white/80')}
          onClick={() => {
            if (!confirmFalse) {
              setConfirmFalse(true);
              return;
            }
            void actions.falseAlarm(alert.id);
          }}
        >
          {confirmFalse ? 'Tap again to confirm false alarm' : 'Mark as false alarm'}
        </button>
      </div>
    </main>
  );
}

function AllClear({ snapshot, now }: { snapshot: Snapshot; now: number }) {
  const stats = dashboardStats(snapshot);
  const watch = rosterEntries(snapshot).filter((e) => e.status === 'watch' || e.status === 'eval');
  const live = liveSession(snapshot);
  const recent = sessionImpacts(snapshot, live?.id).slice(0, 5);
  const [perm, setPerm] = useState<string>('default');
  useEffect(() => {
    setPerm('Notification' in window ? Notification.permission : 'unsupported');
  }, []);

  return (
    <main className="flex flex-1 flex-col">
      <div className="mt-8 flex flex-col items-center text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[hsl(148_45%_30%/0.5)]">
          <ShieldCheck className="h-12 w-12 text-[hsl(148_60%_68%)]" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">All clear</h1>
        <p className="mt-1 text-white/75">
          {live ? live.label : 'No session in progress'} · {stats.helmetsConnected} of {stats.helmetsTotal} helmets connected
        </p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 text-center">
        {[
          { label: 'Impacts', value: stats.impacts },
          { label: 'Alerts', value: stats.alerts },
          { label: 'Watch list', value: stats.watchList },
        ].map((t) => (
          <div key={t.label} className="rounded-2xl bg-navy-soft px-3 py-3">
            <div className="tabular text-2xl font-bold">{t.value}</div>
            <div className="text-xs text-white/70">{t.label}</div>
          </div>
        ))}
      </div>

      {watch.length ? (
        <div className="mt-4 rounded-2xl bg-navy-soft px-4 py-3 text-sm">
          <div className="eyebrow mb-1 text-[hsl(37_90%_70%)]">On the watch list</div>
          {watch.map((e) => (
            <div key={e.player.id} className="flex justify-between py-0.5">
              <span>
                #{e.player.number} {playerShortName(e.player)} · {e.player.position}
              </span>
              <span className="tabular font-bold">{e.peakImpact ? `${Math.round(e.peakImpact.linearG)} g peak` : ''}</span>
            </div>
          ))}
        </div>
      ) : null}

      {recent.length ? (
        <div className="mt-4 rounded-2xl bg-navy-soft px-4 py-3 text-sm">
          <div className="eyebrow mb-1 text-white/60">Latest impacts</div>
          {recent.map((i) => {
            const p = snapshot.players.find((x) => x.id === i.playerId);
            return (
              <div key={i.id} className="flex justify-between py-0.5">
                <span className="text-white/85">
                  <span className="tabular text-white/55">{formatAgo(now - i.at)}</span> · #{p?.number} {p ? playerShortName(p) : ''}
                </span>
                <span className="tabular font-bold">{Math.round(i.linearG)} g</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-auto grid gap-3 pt-8">
        {perm !== 'granted' ? (
          <Button
            variant="outline-inverse"
            size="xl"
            className="h-14"
            onClick={async () => {
              primeAudio();
              playAlertChime();
              const result = await requestNotifications();
              setPerm(result);
              if (result === 'granted') toast.success('Alerts enabled on this device');
              else if (result === 'unsupported') toast.info('Keep this page open — alerts will sound and vibrate here.');
              else toast.warning('Notifications are blocked in this browser’s settings.');
            }}
          >
            <BellRing className="!size-5" /> Enable alerts on this phone
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-sm text-white/70">
            <Bell className="h-4 w-4" /> Alerts enabled on this device
          </div>
        )}
        <Button asChild variant="ghost-inverse" size="xl" className="h-14">
          <Link href="/">Open sideline dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
