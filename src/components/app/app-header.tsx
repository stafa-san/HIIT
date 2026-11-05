'use client';

import {
  Bell,
  BellOff,
  Cable,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Flag,
  RotateCcw,
  Smartphone,
  SkipForward,
  Users,
  Volume2,
  VolumeX,
  Radio,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { actions } from '@/lib/actions';
import { primeAudio, requestNotifications } from '@/lib/alerting';
import { sessionClockLabel } from '@/lib/domain/clock';
import type { Snapshot } from '@/lib/domain/types';
import { liveSession, type DashboardStats } from '@/lib/domain/views';
import { useGateway } from '@/lib/gateway/gateway-store';
import { useNow } from '@/hooks/use-now';
import { usePrefs } from '@/store/prefs-store';
import { useHittStore } from '@/store/hitt-store';
import { cn } from '@/lib/utils';
import { GatewayDialog } from './gateway-dialog';
import { HelmetMark } from './helmet';
import { StartSessionDialog } from './session-dialog';
import { ThresholdDialog } from './threshold-dialog';

export function AppHeader({ snapshot, stats }: { snapshot: Snapshot; stats: DashboardStats }) {
  const now = useNow(1000);
  const session = liveSession(snapshot);
  const [thresholdOpen, setThresholdOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const gatewayOpen = useGateway((s) => s.status);
  const [gatewayDialog, setGatewayDialog] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 bg-navy text-white shadow-md" onPointerDown={primeAudio}>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <HelmetMark className="text-white" />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-wide">H.I.T.T.</div>
            <div className="text-xs text-navy-muted">Sideline · Athletic Trainer</div>
          </div>
        </Link>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-3 rounded-lg px-2 py-1 text-left outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60">
                <span className="hidden text-[15px] text-white/90 md:inline">{session.label}</span>
                <span className="tabular text-lg font-bold">{sessionClockLabel(session, now)}</span>
                <ChevronDown className="h-4 w-4 text-white/60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{session.label}</DropdownMenuLabel>
                {session.clock ? (
                  <>
                    <DropdownMenuItem onSelect={() => void actions.toggleClock()}>
                      {session.clock.runningSince ? <CirclePause /> : <CirclePlay />}
                      {session.clock.runningSince ? 'Stop game clock' : 'Start game clock'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void actions.nextPeriod()}>
                      <SkipForward /> {session.clock.period >= 4 ? 'Start overtime' : `Start Q${session.clock.period + 1}`}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem onSelect={() => setSessionOpen(true)}>
                  <PlusCircle /> Start new session…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-alert" onSelect={() => void actions.endSession()}>
                  <Flag className="!text-alert" /> End session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              onClick={() => setSessionOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-white/40 px-3 py-1.5 text-sm font-bold hover:bg-white/10"
            >
              <PlusCircle className="h-4 w-4" /> Start session
            </button>
          )}

          <div className="flex items-center gap-2 text-[15px] text-white/90">
            <span className={cn('h-2.5 w-2.5 rounded-full', stats.helmetsConnected > 0 ? 'bg-[hsl(148_55%_55%)]' : 'bg-white/40')} />
            <span className="tabular">
              {stats.helmetsConnected} of {stats.helmetsTotal}
              <span className="hidden lg:inline"> helmets connected</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setThresholdOpen(true)}
            className="rounded-full border border-white/50 px-3.5 py-1.5 text-sm transition hover:bg-white/10"
          >
            Alert threshold: <span className="font-bold">{snapshot.team.alertThresholdG} g</span>
          </button>

          <button
            type="button"
            onClick={() => setGatewayDialog(true)}
            className="relative rounded-full p-2 transition hover:bg-white/10"
            title="Sensor gateway"
            aria-label="Sensor gateway"
          >
            <Cable className="h-5 w-5" />
            <span
              className={cn(
                'absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-navy',
                gatewayOpen === 'connected' ? 'bg-[hsl(148_55%_55%)]' : 'bg-white/30',
              )}
            />
          </button>

          <UserMenu onOpenGateway={() => setGatewayDialog(true)} />
        </div>
      </div>

      <ThresholdDialog team={snapshot.team} open={thresholdOpen} onOpenChange={setThresholdOpen} />
      <StartSessionDialog teamName={snapshot.team.name} hasLive={!!session} open={sessionOpen} onOpenChange={setSessionOpen} />
      <GatewayDialog snapshot={snapshot} open={gatewayDialog} onOpenChange={setGatewayDialog} />
    </header>
  );
}

function UserMenu({ onOpenGateway }: { onOpenGateway: () => void }) {
  const router = useRouter();
  const mode = useHittStore((s) => s.mode);
  const { sound, setSound } = usePrefs();
  const [notif, setNotif] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-soft text-sm font-bold ring-1 ring-white/20 outline-none transition hover:ring-white/50 focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Menu"
      >
        AT
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Athletic trainer</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => router.push('/players')}>
          <Users /> Players & season history
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/sensors')}>
          <Radio /> Sensor management
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenGateway}>
          <Cable /> Sensor gateway & simulator
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open('/m', 'hitt-phone', 'width=430,height=900')}>
          <Smartphone /> Coach phone view
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setSound(!sound)}>
          {sound ? <Volume2 /> : <VolumeX />} Alert sound: {sound ? 'on' : 'off'}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={notif === 'unsupported' || notif === 'denied'}
          onSelect={async () => {
            const result = await requestNotifications();
            setNotif(result);
            if (result === 'granted') toast.success('Desktop alerts enabled');
          }}
        >
          {notif === 'granted' ? <Bell /> : <BellOff />}
          {notif === 'granted' ? 'Desktop alerts on' : notif === 'denied' ? 'Alerts blocked in browser' : 'Enable desktop alerts'}
        </DropdownMenuItem>
        {mode === 'demo' ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void actions.resetDemo()}>
              <RotateCcw /> Reset demo data
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
