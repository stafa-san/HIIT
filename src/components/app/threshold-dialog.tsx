'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/field';
import { actions } from '@/lib/actions';
import type { Team } from '@/lib/domain/types';

export function ThresholdDialog({ team, open, onOpenChange }: { team: Team; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [alertG, setAlertG] = useState(team.alertThresholdG);
  const [watchG, setWatchG] = useState(team.watchThresholdG);
  useEffect(() => {
    if (open) {
      setAlertG(team.alertThresholdG);
      setWatchG(team.watchThresholdG);
    }
  }, [open, team.alertThresholdG, team.watchThresholdG]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alert thresholds</DialogTitle>
          <DialogDescription>
            Peak linear acceleration that raises an alert or puts a player on the watch list. Applies to impacts recorded from now on.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <ThresholdField label="Alert threshold" hint="Notify staff and open an evaluation" value={alertG} onChange={setAlertG} min={40} max={150} />
          <ThresholdField label="Watch threshold" hint="Flag on the roster, no notification" value={watchG} onChange={setWatchG} min={20} max={alertG - 1} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (await actions.thresholds(alertG, watchG)) onOpenChange(false);
            }}
          >
            Save thresholds
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThresholdField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer accent-[hsl(var(--navy))]"
        />
        <div className="relative w-24">
          <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="pr-7 text-right font-bold" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">g</span>
        </div>
      </div>
    </div>
  );
}
