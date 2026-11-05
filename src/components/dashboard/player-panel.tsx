'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { HelmetGraphic } from '@/components/app/helmet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckRow, Label, Textarea } from '@/components/ui/field';
import { actions } from '@/lib/actions';
import { periodLabel } from '@/lib/domain/clock';
import { isRtpActive, RTP_STEPS } from '@/lib/domain/rtp';
import type { EvaluationOutcome, Impact, Snapshot } from '@/lib/domain/types';
import { playerName, type PlayerSessionDetail } from '@/lib/domain/views';
import { cn, formatNumber } from '@/lib/utils';

export function PlayerPanel({ snapshot, detail }: { snapshot: Snapshot; detail: PlayerSessionDetail | null }) {
  if (!detail) {
    return (
      <Card className="p-6 text-center text-muted-foreground">Select a player to see their session.</Card>
    );
  }
  const { player, peak, last, alert, hits, buckets, sensor, session } = detail;
  const threshold = snapshot.team.alertThresholdG;
  const over = peak ? Math.round(peak.linearG - threshold) : null;
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold">
          #{player.number} {playerName(player)}
        </h2>
        <span className="pt-1 text-right text-sm text-muted-foreground">
          {last ? (
            <>Last impact · {last.period ? `${periodLabel(last.period)} ` : ''}{last.clockLabel}</>
          ) : session ? (
            'No impacts this session'
          ) : (
            'No live session'
          )}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-4">
        <div className="flex flex-col items-center justify-center">
          <HelmetGraphic className="h-28 w-32" alert={!!alert && alert.evaluation?.status !== 'resolved'} />
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {sensor ? `1 sensor · ${sensor.mount} mount` : 'No sensor assigned'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Peak linear" value={peak ? `${Math.round(peak.linearG)} g` : '—'} tone={peak && peak.linearG >= threshold ? 'alert' : undefined} />
          <Metric label="Rotational" value={peak?.rotationalRadS2 ? formatNumber(peak.rotationalRadS2) : '—'} unit={peak?.rotationalRadS2 ? 'rad/s²' : undefined} />
          <Metric
            label={over !== null && over < 0 ? 'Under threshold' : 'Over threshold'}
            value={over === null ? '—' : `${over > 0 ? '+' : ''}${over} g`}
          />
          <Metric label="Session hits" value={String(hits)} />
        </div>
      </div>

      {buckets.length ? (
        <div className="mt-5">
          <div className="eyebrow mb-2 text-muted-foreground">{session?.clock ? 'Impacts by quarter' : 'Impacts by 15 minutes'}</div>
          <div className="flex h-16 items-end gap-2">
            {buckets.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-stretch justify-end">
                <div
                  className={cn('rounded-sm', b.count === 0 ? 'bg-chart-track' : b.hasAlert ? 'bg-alert' : 'bg-navy')}
                  style={{ height: b.count === 0 ? 4 : `${Math.max(14, (b.count / maxBucket) * 44)}px` }}
                  title={`${b.label}: ${b.count} impacts`}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2">
            {buckets.map((b) => (
              <div key={b.label} className="tabular flex-1 text-center text-xs text-muted-foreground">
                {b.label} · {b.count}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="my-4 h-px bg-border" />
      {alert ? (
        <EvaluationChecklist alert={alert} />
      ) : isRtpActive(player) && player.rtp ? (
        <div className="rounded-xl bg-alert-soft p-4 text-sm">
          <div className="font-bold text-alert">Out · return-to-play step {player.rtp.currentStep} of 6</div>
          <div className="text-muted-foreground">{RTP_STEPS[player.rtp.currentStep - 1]?.title}</div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No alert-level impacts this session.</p>
      )}

      <Link
        href={`/players/${player.id}`}
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-info hover:underline"
      >
        Season history & return-to-play <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

function Metric({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'alert' }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('tabular text-[22px] font-bold leading-tight', tone === 'alert' && 'text-alert')}>
        {value}
        {unit ? <span className="block text-xs font-bold leading-tight">{unit}</span> : null}
      </div>
    </div>
  );
}

const OUTCOME_LABEL: Record<EvaluationOutcome, string> = {
  cleared: 'Cleared — returned to play',
  protocol: 'In protocol — return-to-play started',
  excluded: 'Excluded — not a real impact',
};

function EvaluationChecklist({ alert }: { alert: Impact }) {
  const ev = alert.evaluation!;
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const resolved = ev.status === 'resolved';
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow text-muted-foreground">Evaluation checklist</div>
        {ev.status === 'evaluating' ? <Badge tone="alert-soft">Evaluating</Badge> : null}
        {ev.status === 'open' ? <Badge tone="alert">Open</Badge> : null}
      </div>
      <CheckRow checked={ev.checklist.removed} disabled={resolved} onChange={(v) => void actions.checklist(alert.id, 'removed', v)} label="Removed from play" />
      <CheckRow checked={ev.checklist.assessed} disabled={resolved} onChange={(v) => void actions.checklist(alert.id, 'assessed', v)} label="Sideline assessment completed" />
      <CheckRow
        checked={ev.checklist.physicianNotified}
        disabled={resolved}
        onChange={(v) => void actions.checklist(alert.id, 'physicianNotified', v)}
        label="Team physician notified"
      />
      {resolved && ev.outcome ? (
        <div className="mt-1 flex items-start gap-3 py-1.5 text-[15px]">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          <div>
            <div>Outcome logged</div>
            <div className="text-sm font-bold">{OUTCOME_LABEL[ev.outcome]}</div>
            {ev.note ? <div className="text-xs text-muted-foreground">{ev.note}</div> : null}
          </div>
        </div>
      ) : (
        <CheckRow checked={false} onChange={() => setOutcomeOpen(true)} label="Outcome logged / return-to-play status" />
      )}
      <OutcomeDialog alert={alert} open={outcomeOpen} onOpenChange={setOutcomeOpen} />
    </div>
  );
}

function OutcomeDialog({ alert, open, onOpenChange }: { alert: Impact; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [outcome, setOutcome] = useState<EvaluationOutcome>('protocol');
  const [note, setNote] = useState('Removed from play, physician notified');
  const options: Array<{ id: EvaluationOutcome; title: string; detail: string; suggested: string }> = [
    { id: 'protocol', title: 'Start return-to-play protocol', detail: 'Player is out. Opens the graduated 6-step protocol.', suggested: 'Removed from play, physician notified' },
    { id: 'cleared', title: 'Cleared to return', detail: 'Sideline assessment normal.', suggested: 'Sideline assessment normal' },
    { id: 'excluded', title: 'Exclude this impact', detail: 'Helmet not worn, dropped or false reading. Not counted.', suggested: 'Helmet not worn (dropped), not counted' },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log outcome</DialogTitle>
          <DialogDescription>
            {Math.round(alert.linearG)} g impact. Return-to-play decisions are made by the athletic trainer and a licensed healthcare provider.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOutcome(o.id);
                if (!note || options.some((x) => x.suggested === note)) setNote(o.suggested);
              }}
              className={cn(
                'rounded-xl border-2 px-4 py-3 text-left transition',
                outcome === o.id ? (o.id === 'protocol' ? 'border-alert bg-alert-soft' : 'border-navy bg-info-soft') : 'border-border hover:border-navy/40',
              )}
            >
              <div className="font-bold">{o.title}</div>
              <div className="text-sm text-muted-foreground">{o.detail}</div>
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="outcome-note">Note</Label>
          <Textarea id="outcome-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Findings, who was notified…" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'protocol' ? 'alert' : 'default'}
            onClick={async () => {
              if (await actions.outcome(alert.id, outcome, note)) onOpenChange(false);
            }}
          >
            Log outcome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
