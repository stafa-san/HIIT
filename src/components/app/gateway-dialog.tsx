'use client';

import { Cable, Play, Square, Unplug, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Select } from '@/components/ui/field';
import { DATA_MODE } from '@/lib/config';
import type { Snapshot } from '@/lib/domain/types';
import { playerShortName, rosterEntries } from '@/lib/domain/views';
import {
  connectSerial,
  disconnectSerial,
  isSerialSupported,
  setAutoPlay,
  simulateImpact,
  useGateway,
} from '@/lib/gateway/gateway-store';
import { cn, formatTime } from '@/lib/utils';

export function GatewayDialog({
  snapshot,
  open,
  onOpenChange,
}: {
  snapshot: Snapshot;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const gw = useGateway();
  const [supported, setSupported] = useState(true);
  const [simSensor, setSimSensor] = useState<string>('');
  useEffect(() => setSupported(isSerialSupported()), []);

  const entries = useMemo(
    () => rosterEntries(snapshot).sort((a, b) => a.player.number - b.player.number),
    [snapshot],
  );
  const connected = gw.status === 'connected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sensor gateway</DialogTitle>
          <DialogDescription>
            Connect a helmet sensor over USB, or simulate impacts for a demo.
            {DATA_MODE === 'firebase'
              ? ' Readings sync to every signed-in device in real time.'
              : ' Demo mode: readings stay in this browser.'}
          </DialogDescription>
        </DialogHeader>

        {/* USB */}
        <section className="rounded-xl border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold">
              <Cable className="h-4 w-4" /> USB sensor (Web Serial)
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide',
                connected ? 'text-success' : gw.status === 'error' ? 'text-alert' : 'text-muted-foreground',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-success' : gw.status === 'error' ? 'bg-alert' : 'bg-muted-foreground/50')} />
              {gw.status}
            </span>
          </div>
          {!supported ? (
            <p className="rounded-lg bg-watch-soft px-3 py-2 text-sm text-watch-foreground">
              This browser cannot open serial ports. Plug the sensor into a laptop running Chrome or Edge and open the gateway there — other devices
              {DATA_MODE === 'firebase' ? ' will receive the alerts through Firebase.' : ' need Firebase mode to receive them.'}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="grid gap-1.5">
              <Label>Baud rate</Label>
              <Select value={gw.baudRate} disabled={connected} onChange={(e) => useGateway.setState({ baudRate: Number(e.target.value) })}>
                {[9600, 19200, 57600, 115200].map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Default sensor (readings with no ID)</Label>
              <Select
                value={gw.defaultSensorId ?? ''}
                onChange={(e) => useGateway.setState({ defaultSensorId: e.target.value || null })}
              >
                <option value="">— choose —</option>
                {entries.map((e) => (
                  <option key={e.sensor.id} value={e.sensor.id}>
                    {e.sensor.id} · #{e.player.number} {playerShortName(e.player)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label title="Multiply raw readings by this to convert to g">Scale → g</Label>
              <Input type="number" step="0.01" value={gw.scale} onChange={(e) => useGateway.setState({ scale: Number(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {connected ? (
              <Button variant="outline" onClick={() => void disconnectSerial()}>
                <Unplug /> Disconnect
              </Button>
            ) : (
              <Button disabled={!supported || gw.status === 'connecting'} onClick={() => void connectSerial()}>
                <Cable /> {gw.status === 'connecting' ? 'Connecting…' : 'Connect sensor'}
              </Button>
            )}
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Trigger
              <Input
                type="number"
                className="h-9 w-20"
                value={gw.triggerG}
                onChange={(e) => useGateway.setState({ triggerG: Number(e.target.value) || 0 })}
              />
              g
            </label>
            <span className="text-sm text-muted-foreground">
              {gw.forwarded} impact{gw.forwarded === 1 ? '' : 's'} forwarded
            </span>
          </div>
          {gw.error ? <p className="mt-2 text-sm text-alert">{gw.error}</p> : null}
        </section>

        {/* Simulator */}
        <section className="rounded-xl border p-4">
          <div className="mb-3 flex items-center gap-2 font-bold">
            <Zap className="h-4 w-4" /> Simulator
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Select value={simSensor} onChange={(e) => setSimSensor(e.target.value)}>
              <option value="">Random connected player</option>
              {entries.map((e) => (
                <option key={e.sensor.id} value={e.sensor.id} disabled={e.status === 'out'}>
                  #{e.player.number} {playerShortName(e.player)} · {e.player.position}
                  {e.status === 'out' ? ' (out)' : ''}
                  {e.sensor.connection === 'offline' ? ' (sensor offline)' : ''}
                </option>
              ))}
            </Select>
            <Button
              variant={gw.autoPlay ? 'alert' : 'outline'}
              onClick={() => setAutoPlay(!gw.autoPlay)}
              title="Random impacts every few seconds"
            >
              {gw.autoPlay ? <Square /> : <Play />} {gw.autoPlay ? 'Stop auto-play' : 'Auto-play game'}
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => void simulateImpact('routine', simSensor || null)}>
              Routine hit
            </Button>
            <Button variant="outline" className="border-watch text-watch-foreground" onClick={() => void simulateImpact('watch', simSensor || null)}>
              Watch-level hit
            </Button>
            <Button variant="alert" onClick={() => void simulateImpact('alert', simSensor || null)}>
              Alert-level hit
            </Button>
          </div>
        </section>

        {/* Log */}
        <section>
          <div className="eyebrow mb-2 text-muted-foreground">Gateway log</div>
          <div className="h-40 overflow-y-auto rounded-xl bg-navy p-3 font-mono text-xs leading-relaxed text-white/85">
            {gw.log.length === 0 ? (
              <p className="text-white/50">Waiting for readings…</p>
            ) : (
              gw.log.map((line) => (
                <div key={line.id} className={cn(line.kind === 'impact' && 'text-[hsl(148_60%_70%)]', line.kind === 'error' && 'text-[hsl(353_90%_75%)]', line.kind === 'info' && 'text-white/55')}>
                  <span className="text-white/40">{formatTime(line.at)}</span> {line.text}
                </div>
              ))
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
