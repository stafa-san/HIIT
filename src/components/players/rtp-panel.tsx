'use client';

import { Check, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/field';
import { actions } from '@/lib/actions';
import { canCompleteCurrentStep, hoursInCurrentStep, MIN_HOURS_PER_STEP, RTP_STEPS, stepState } from '@/lib/domain/rtp';
import type { Impact, Player, Team } from '@/lib/domain/types';
import { cn, formatDate } from '@/lib/utils';

export function RtpPanel({ player, team, triggeringAlert, now }: { player: Player; team: Team; triggeringAlert: Impact | null; now: number }) {
  const rtp = player.rtp;
  const [clearanceOpen, setClearanceOpen] = useState(false);

  if (!rtp) {
    return (
      <Card className="flex h-full flex-col p-5">
        <h2 className="text-lg font-bold">Return-to-play</h2>
        <p className="mt-1 text-sm text-muted-foreground">Not in a return-to-play protocol.</p>
        <div className="mt-6 flex flex-1 flex-col items-center justify-center rounded-xl bg-success-soft p-6 text-center">
          <ShieldCheck className="h-10 w-10 text-success" />
          <div className="mt-2 font-bold">Active · full participation</div>
          <p className="mt-1 text-sm text-muted-foreground">
            A protocol starts automatically when an alert outcome is logged as &ldquo;start return-to-play&rdquo;.
          </p>
        </div>
        <Button variant="outline" className="no-print mt-4" onClick={() => void actions.startRtp(player.id)}>
          Start protocol manually
        </Button>
        <Disclaimer />
      </Card>
    );
  }

  const done = rtp.completedAt !== null;
  const gate = canCompleteCurrentStep(rtp);
  const hours = hoursInCurrentStep(rtp, now);

  return (
    <Card className="flex h-full flex-col p-5">
      <h2 className="text-lg font-bold">Return-to-play</h2>
      <p className="text-sm text-muted-foreground">
        Started {formatDate(rtp.startedAt)}
        {triggeringAlert ? ` after the ${formatDate(triggeringAlert.at)} alert` : ''}
        {done ? ` · completed ${formatDate(rtp.completedAt!)}` : ''}
      </p>

      <ol className="mt-5">
        {RTP_STEPS.map((step, i) => {
          const state = stepState(rtp, step.n);
          const s = rtp.steps[String(step.n)];
          const last = i === RTP_STEPS.length - 1;
          let detail = 'Not started';
          if (state === 'complete' && s?.completedAt) detail = `Completed ${formatDate(s.completedAt)}`;
          else if (state === 'current' && s?.startedAt) detail = `In progress · started ${formatDate(s.startedAt)}`;
          else if ('requiresClearance' in step && step.requiresClearance && rtp.clearance.status !== 'granted') detail = 'Requires medical clearance';
          return (
            <li key={step.n} className="relative flex gap-4 pb-5 last:pb-0">
              {!last ? (
                <span className={cn('absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5', state === 'complete' ? 'bg-success' : 'bg-border')} />
              ) : null}
              <span
                className={cn(
                  'relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold',
                  state === 'complete' && 'border-success bg-success text-white',
                  state === 'current' && 'border-navy bg-navy text-white ring-4 ring-navy/15',
                  state === 'upcoming' && 'border-border bg-card text-muted-foreground',
                )}
              >
                {state === 'complete' ? <Check className="h-5 w-5" strokeWidth={3} /> : step.n}
              </span>
              <div className="pt-1">
                <div className={cn('font-bold', state === 'upcoming' && 'text-foreground/80')}>{step.title}</div>
                <div className="text-sm text-muted-foreground">{detail}</div>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className={cn(
          'mt-5 rounded-xl px-4 py-3',
          rtp.clearance.status === 'granted' ? 'bg-success-soft' : 'bg-watch-soft',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={cn('eyebrow', rtp.clearance.status === 'granted' ? 'text-success' : 'text-watch-foreground')}>
              Medical clearance · {rtp.clearance.status === 'granted' ? 'granted' : 'pending'}
            </div>
            <div className="mt-0.5 text-[15px]">
              {rtp.clearance.status === 'granted'
                ? `${rtp.clearance.physician} · ${formatDate(rtp.clearance.grantedAt!)}`
                : `Required before full contact. Physician: ${team.physicianName}`}
            </div>
          </div>
          {rtp.clearance.status !== 'granted' && !done ? (
            <Button size="sm" variant="outline" className="no-print shrink-0" onClick={() => setClearanceOpen(true)}>
              Record
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-auto pt-6">
        {done ? (
          <div className="rounded-xl bg-success-soft px-4 py-3 text-center font-bold text-success">Protocol complete — returned to play</div>
        ) : (
          <>
            {!gate.ok ? <p className="mb-2 text-sm text-watch-foreground">{gate.reason}</p> : null}
            {gate.ok && hours !== null && hours < MIN_HOURS_PER_STEP ? (
              <p className="mb-2 text-xs text-muted-foreground">
                Step {rtp.currentStep} started {Math.max(0, Math.round(hours))} h ago — steps are normally at least 24 hours apart.
              </p>
            ) : null}
            <Button
              size="lg"
              className="no-print w-full"
              disabled={!gate.ok}
              onClick={() => void actions.completeRtpStep(player.id, rtp.currentStep)}
            >
              Log step {rtp.currentStep} complete
            </Button>
          </>
        )}
        <Disclaimer />
      </div>

      <ClearanceDialog
        open={clearanceOpen}
        onOpenChange={setClearanceOpen}
        defaultPhysician={team.physicianName}
        onSave={async (name) => {
          if (await actions.clearance(player.id, name)) setClearanceOpen(false);
        }}
      />
    </Card>
  );
}

function Disclaimer() {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      H.I.T.T. records protocol steps. Return-to-play decisions are made by the athletic trainer and a licensed healthcare provider.
    </p>
  );
}

function ClearanceDialog({
  open,
  onOpenChange,
  defaultPhysician,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultPhysician: string;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(defaultPhysician);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record medical clearance</DialogTitle>
          <DialogDescription>Written clearance from a licensed healthcare provider is required before full-contact practice.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="physician">Clearing physician</Label>
          <Input id="physician" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(name)}>Record clearance</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
