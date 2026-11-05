'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/field';
import { actions } from '@/lib/actions';
import type { SessionType } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

const DRILLS = ['tackling drill', 'Oklahoma drill', 'team period', 'individual periods', 'walkthrough', '7-on-7'];

export function StartSessionDialog({
  teamName,
  hasLive,
  open,
  onOpenChange,
}: {
  teamName: string;
  hasLive: boolean;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [type, setType] = useState<SessionType>('game');
  const [opponent, setOpponent] = useState('');
  const [drill, setDrill] = useState(DRILLS[0]);

  const label = type === 'game' ? `${teamName} vs. ${opponent.trim() || 'Opponent'}` : `Practice · ${drill}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a session</DialogTitle>
          <DialogDescription>
            Impacts are grouped by session for season history.
            {hasLive ? ' The current session will be ended.' : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(['game', 'practice'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                'rounded-xl border-2 px-4 py-3 text-left font-bold capitalize transition',
                type === t ? 'border-navy bg-info-soft' : 'border-border hover:border-navy/40',
              )}
            >
              {t}
              <span className="block text-xs font-normal text-muted-foreground">
                {t === 'game' ? '4 × 12:00 quarters with game clock' : 'Elapsed time, no quarters'}
              </span>
            </button>
          ))}
        </div>
        {type === 'game' ? (
          <div className="grid gap-2">
            <Label htmlFor="opponent">Opponent</Label>
            <Input id="opponent" placeholder="e.g. Ridgeview" value={opponent} onChange={(e) => setOpponent(e.target.value)} autoFocus />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Focus</Label>
            <div className="flex flex-wrap gap-2">
              {DRILLS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDrill(d)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm',
                    drill === d ? 'border-navy bg-navy text-white' : 'hover:bg-muted',
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">Session name: </span>
          <span className="font-bold">{label}</span>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (await actions.startSession(type, opponent, label)) {
                onOpenChange(false);
                setOpponent('');
              }
            }}
          >
            Start {type}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
