'use client';

import { Check, Info, Loader2, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AppFooter } from '@/components/app/app-footer';
import { DataGate } from '@/components/app/data-gate';
import { HelmetGraphic } from '@/components/app/helmet';
import { PageHeader } from '@/components/app/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckRow, Input, Label, Select } from '@/components/ui/field';
import { actions, ingestReading } from '@/lib/actions';
import { SENSOR_ID_PATTERN } from '@/lib/domain/commands';
import type { Player, Snapshot } from '@/lib/domain/types';
import {
  careerImpacts,
  fleetSummary,
  playerName,
  playersWithoutSensor,
  playerShortName,
  sensorRows,
  type SensorRow,
  type SensorState,
} from '@/lib/domain/views';
import { cn, formatDate, formatTime } from '@/lib/utils';

export function SensorManagement() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DataGate>{(snapshot) => <SensorsView snapshot={snapshot} />}</DataGate>
    </div>
  );
}

type Filter = 'all' | 'needs-reassign' | 'spare' | 'offline' | 'retired';

const STATE_BADGE: Record<SensorState, { label: string; tone: 'watch' | 'neutral' | 'ok' | 'offline' }> = {
  'needs-reassign': { label: 'Needs reassign', tone: 'watch' },
  spare: { label: 'Spare', tone: 'neutral' },
  assigned: { label: 'Assigned', tone: 'ok' },
  retired: { label: 'Retired', tone: 'offline' },
};

function SensorsView({ snapshot }: { snapshot: Snapshot }) {
  const rows = useMemo(() => sensorRows(snapshot), [snapshot]);
  const fleet = fleetSummary(rows);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.sensor.id ?? null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const visible = rows.filter((r) => {
    if (filter === 'needs-reassign' && r.state !== 'needs-reassign') return false;
    if (filter === 'spare' && r.state !== 'spare') return false;
    if (filter === 'retired' && r.state !== 'retired') return false;
    if (filter === 'offline' && !(r.player && r.sensor.connection === 'offline' && r.state !== 'retired')) return false;
    if (filter === 'all' && r.state === 'retired') return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.sensor.id.toLowerCase().includes(q) ||
      (r.player && (playerName(r.player).toLowerCase().includes(q) || String(r.player.number) === q.replace('#', '')))
    );
  });
  const selected = rows.find((r) => r.sensor.id === selectedId) ?? null;

  return (
    <>
      <PageHeader
        title="Sensor management"
        subtitle={`H.I.T.T. · ${snapshot.team.name} · 1 sensor per helmet`}
        actions={
          <>
            <span className="hidden text-[15px] text-white/85 md:inline">
              {fleet.total} sensors · {fleet.assigned} assigned · {fleet.spare} spare
            </span>
            <Button variant="outline-inverse" onClick={() => setRegisterOpen(true)}>
              <Plus /> Register new sensor
            </Button>
          </>
        }
      />
      <main className="mx-auto grid w-full max-w-[1440px] flex-1 items-start gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Card className="overflow-hidden">
          <div className="p-5 pb-3">
            <h2 className="text-lg font-bold">Sensors</h2>
            <label className="mt-3 block text-sm text-muted-foreground" htmlFor="sensor-search">
              Search by sensor ID or player
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="sensor-search" className="pl-10" placeholder="e.g. HT-0142 or Doyle" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                All
              </FilterChip>
              <FilterChip active={filter === 'needs-reassign'} onClick={() => setFilter('needs-reassign')}>
                Needs reassignment · {fleet.needsReassign}
              </FilterChip>
              <FilterChip active={filter === 'spare'} onClick={() => setFilter('spare')}>
                Spare · {fleet.spare}
              </FilterChip>
              {fleet.offline ? (
                <FilterChip active={filter === 'offline'} onClick={() => setFilter('offline')}>
                  Offline · {fleet.offline}
                </FilterChip>
              ) : null}
              {fleet.retired ? (
                <FilterChip active={filter === 'retired'} onClick={() => setFilter('retired')}>
                  Retired · {fleet.retired}
                </FilterChip>
              ) : null}
            </div>
          </div>
          <div className="max-h-[calc(100dvh-300px)] min-h-[320px] overflow-y-auto">
            <table className="w-full text-[15px]">
              <thead className="sticky top-0 z-[1] bg-card text-left text-xs uppercase tracking-wide text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
                <tr>
                  <th className="py-2.5 pl-5 pr-2 font-semibold">Sensor</th>
                  <th className="px-2 py-2.5 font-semibold">Assigned to</th>
                  <th className="px-2 py-2.5 font-semibold">Status</th>
                  <th className="py-2.5 pl-2 pr-5 text-right font-semibold">Batt.</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.sensor.id}
                    onClick={() => setSelectedId(r.sensor.id)}
                    className={cn(
                      'cursor-pointer border-b transition hover:bg-muted/60',
                      r.sensor.id === selectedId && 'bg-info-soft shadow-[inset_4px_0_0_hsl(var(--navy))] hover:bg-info-soft',
                    )}
                  >
                    <td className="py-3 pl-5 pr-2 font-bold">
                      <span className="flex items-center gap-2">
                        {r.sensor.id}
                        {r.state !== 'retired' && r.sensor.connection === 'online' ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-success" title="Connected" />
                        ) : null}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {r.player ? (
                        <>
                          <div className="font-bold">
                            #{r.player.number} {playerShortName(r.player)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {r.player.position}
                            {r.state === 'needs-reassign' ? ` · ${r.player.note ?? 'Inactive'}` : ''}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-bold">Unassigned</div>
                          <div className="text-xs text-muted-foreground">{r.state === 'retired' ? 'Retired' : 'In equipment room'}</div>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <Badge tone={STATE_BADGE[r.state].tone} casing="normal">
                        {STATE_BADGE[r.state].label}
                      </Badge>
                    </td>
                    <td className={cn('tabular py-3 pl-2 pr-5 text-right', (r.sensor.battery ?? 100) < 20 && 'font-bold text-alert')}>
                      {r.sensor.battery === null ? '—' : `${r.sensor.battery}%`}
                    </td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                      No sensors match.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        {selected ? (
          <SensorEditor key={selected.sensor.id} snapshot={snapshot} row={selected} />
        ) : (
          <Card className="p-10 text-center text-muted-foreground">Select a sensor.</Card>
        )}
      </main>
      <AppFooter note="Each sensor's impacts stay with the player who wore it — reassigning a sensor never moves history." />
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onRegistered={(id) => {
          setFilter('all');
          setSelectedId(id);
        }}
      />
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('h-10 rounded-full border px-4 text-sm font-semibold transition', active ? 'border-navy bg-navy text-white' : 'bg-card hover:bg-muted')}
    >
      {children}
    </button>
  );
}

const REASONS = ['Graduated', 'No longer playing', 'Injured — out for season', 'Helmet replaced', 'Sensor fault', 'Other'];

function defaultReason(player: Player | null): string {
  if (!player) return 'Other';
  if (player.rosterStatus === 'graduated') return 'Graduated';
  if (player.rosterStatus === 'inactive') return 'No longer playing';
  return 'Helmet replaced';
}

function SensorEditor({ snapshot, row }: { snapshot: Snapshot; row: SensorRow }) {
  const { sensor, player, state } = row;
  const [reason, setReason] = useState(defaultReason(player));
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rosterQuery, setRosterQuery] = useState('');
  const [removed, setRemoved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [testFrom, setTestFrom] = useState<number | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const candidates = playersWithoutSensor(snapshot).filter((p) => {
    const q = rosterQuery.trim().toLowerCase();
    return !q || playerName(p).toLowerCase().includes(q) || String(p.number) === q.replace('#', '') || p.position.toLowerCase() === q;
  });
  const target = snapshot.players.find((p) => p.id === targetId) ?? null;
  const tapped = testFrom !== null && sensor.lastTestTap !== null && sensor.lastTestTap.at >= testFrom;
  const waiting = testFrom !== null && !tapped;
  const hasPrevious = !!player;

  // Stop listening for a tap if the editor goes away mid-test.
  useEffect(() => {
    return () => {
      void actions.cancelTest(sensor.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sensor.id]);

  if (state === 'retired') {
    return (
      <Card className="p-6">
        <div className="eyebrow text-muted-foreground">Retired sensor</div>
        <h2 className="mt-1 text-2xl font-bold">{sensor.id}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Out of service. Its impact history stays with the players who wore it.</p>
        <History snapshot={snapshot} row={row} />
        <Button className="mt-6" onClick={() => void actions.reactivate(sensor.id)}>
          Return to service as a spare
        </Button>
      </Card>
    );
  }

  const runTest = async () => {
    const start = Date.now();
    setTestFrom(start);
    await actions.beginTest(sensor.id);
  };

  return (
    <Card className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-5">
        <div>
          <div className="eyebrow text-muted-foreground">Edit sensor</div>
          <h2 className="mt-1 text-2xl font-bold">
            {hasPrevious ? 'Reassign' : 'Assign'} {sensor.id}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', sensor.connection === 'online' ? 'bg-success' : 'bg-muted-foreground/40')} />
            {sensor.connection === 'online' ? 'Connected' : 'Offline'}
          </span>
          <span>Battery {sensor.battery === null ? '—' : `${sensor.battery}%`}</span>
          <span>Firmware {sensor.firmware}</span>
        </div>
      </div>

      <div className="grid gap-7 px-6 py-6">
        {/* Step 1 */}
        <Step n={1} title={hasPrevious ? 'Release from current player' : 'Current location'} done={!hasPrevious}>
          {player ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <div className="rounded-xl bg-muted px-4 py-3">
                  <div className="text-xs text-muted-foreground">Currently in helmet of</div>
                  <div className="font-bold">
                    #{player.number} {playerName(player)} · {player.position} · {player.classYear}
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="reason" className="text-xs">
                    Reason
                  </Label>
                  <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-info-soft px-4 py-2.5 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                {playerShortName(player)}&rsquo;s {careerImpacts(snapshot, player).toLocaleString()} recorded impacts stay on the player record. They do not move with the sensor.
              </p>
            </>
          ) : (
            <div className="rounded-xl bg-muted px-4 py-3 text-[15px]">
              Spare · in equipment room
              <span className="block text-xs text-muted-foreground">Registered {formatDate(sensor.registeredAt)}</span>
            </div>
          )}
        </Step>

        {/* Step 2 */}
        <Step n={2} title="Choose new player" done={!!target}>
          <div className="text-sm text-muted-foreground">Players without a sensor</div>
          <Input className="mt-1.5" placeholder="Search roster" value={rosterQuery} onChange={(e) => setRosterQuery(e.target.value)} />
          {candidates.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
              Every active player already has a sensor.
            </p>
          ) : (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2" role="radiogroup">
              {candidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === targetId}
                  onClick={() => setTargetId(p.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition',
                    p.id === targetId ? 'border-2 border-navy bg-info-soft' : 'hover:border-navy/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      p.id === targetId ? 'border-info' : 'border-input',
                    )}
                  >
                    {p.id === targetId ? <span className="h-2.5 w-2.5 rounded-full bg-info" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold">
                      #{p.number} {playerName(p)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {p.position} · {p.classYear}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Step>

        {/* Step 3 */}
        <Step n={3} title="Install and verify" done={(hasPrevious ? removed : true) && mounted && tapped}>
          <div className="grid items-center gap-4 sm:grid-cols-[110px_1fr_auto]">
            <HelmetGraphic className="hidden h-20 w-24 sm:block" />
            <div>
              {hasPrevious ? <CheckRow checked={removed} onChange={setRemoved} label="Sensor removed from old helmet" /> : null}
              <CheckRow checked={mounted} onChange={setMounted} label="Mounted at crown of new helmet" />
              <CheckRow
                checked={tapped}
                onChange={() => (tapped ? undefined : void runTest())}
                label="Test tap registered on dashboard"
                hint={
                  tapped && sensor.lastTestTap
                    ? `${Math.round(sensor.lastTestTap.linearG)} g at ${formatTime(sensor.lastTestTap.at)}`
                    : waiting
                      ? 'Listening — tap the sensor firmly'
                      : undefined
                }
              />
            </div>
            <div className="flex flex-col items-stretch gap-1.5">
              <Button variant="outline" onClick={() => void runTest()} disabled={waiting}>
                {waiting ? <Loader2 className="animate-spin" /> : tapped ? <Check /> : null}
                {waiting ? 'Waiting for tap…' : tapped ? 'Run again' : 'Run test tap'}
              </Button>
              {waiting ? (
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => void ingestReading({ sensorId: sensor.id, linearG: 10 + Math.random() * 8 })}
                >
                  Simulate tap
                </button>
              ) : null}
            </div>
          </div>
        </Step>

        <History snapshot={snapshot} row={row} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t bg-muted/40 px-6 py-4">
        {confirmRetire ? (
          <span className="flex items-center gap-2 text-sm">
            Retire {sensor.id}?
            <Button size="sm" variant="alert" onClick={() => void actions.retire(sensor.id, hasPrevious ? reason : 'Retired')}>
              Yes, retire
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRetire(false)}>
              No
            </Button>
          </span>
        ) : (
          <>
            <Button variant="link-alert" onClick={() => setConfirmRetire(true)}>
              Retire this sensor instead
            </Button>
            {hasPrevious ? (
              <Button variant="link" className="text-muted-foreground" onClick={() => void actions.release(sensor.id, reason)}>
                Return to spares
              </Button>
            ) : null}
          </>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {sensor.id} → {target ? `#${target.number} ${playerName(target)}` : 'choose a player'}
          </span>
          <Button
            variant="outline"
            onClick={() => {
              setTargetId(null);
              setRemoved(false);
              setMounted(false);
              setTestFrom(null);
              void actions.cancelTest(sensor.id);
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!target}
            onClick={async () => {
              if (!target) return;
              const ok = await actions.reassign(sensor.id, target.id, hasPrevious ? reason : null, `#${target.number} ${playerName(target)}`);
              if (ok) {
                setTargetId(null);
                setTestFrom(null);
              }
            }}
          >
            Save {hasPrevious ? 'reassignment' : 'assignment'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-[36px_1fr] gap-x-4">
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
          done ? 'bg-success text-white' : 'bg-navy text-white',
        )}
      >
        {done ? <Check className="h-5 w-5" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0">
        <h3 className="pt-1.5 text-lg font-bold">{title}</h3>
        <div className="mt-3">{children}</div>
      </div>
    </section>
  );
}

function History({ snapshot, row }: { snapshot: Snapshot; row: SensorRow }) {
  const entries = [...row.sensor.history].reverse().slice(0, 4);
  if (!entries.length) return null;
  return (
    <div className="rounded-xl border px-4 py-3">
      <div className="eyebrow mb-1.5 text-muted-foreground">Assignment history</div>
      <ul className="grid gap-1 text-sm">
        {entries.map((h, i) => {
          const p = snapshot.players.find((x) => x.id === h.playerId);
          return (
            <li key={`${h.from}-${i}`} className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold">{p ? `#${p.number} ${playerShortName(p)}` : 'Spare'}</span>
              <span className="text-muted-foreground">
                {formatDate(h.from)} – {h.to ? formatDate(h.to) : 'now'}
                {h.reason ? ` · ${h.reason}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RegisterDialog({
  open,
  onOpenChange,
  onRegistered,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRegistered: (id: string) => void;
}) {
  const [id, setId] = useState('');
  const [firmware, setFirmware] = useState('1.3');
  const [battery, setBattery] = useState('100');
  const valid = SENSOR_ID_PATTERN.test(id.trim().toUpperCase());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register new sensor</DialogTitle>
          <DialogDescription>New sensors start as spares in the equipment room. Assign one to a player from the list.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5 sm:col-span-3">
            <Label htmlFor="sensor-id">Sensor ID (printed on the housing)</Label>
            <Input id="sensor-id" placeholder="HT-0200" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fw">Firmware</Label>
            <Input id="fw" value={firmware} onChange={(e) => setFirmware(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="batt">Battery %</Label>
            <Input id="batt" type="number" min={0} max={100} value={battery} onChange={(e) => setBattery(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={async () => {
              const sensorId = id.trim().toUpperCase();
              const pct = battery.trim() === '' ? null : Math.max(0, Math.min(100, Number(battery)));
              if (await actions.register(sensorId, firmware, pct)) {
                onOpenChange(false);
                onRegistered(sensorId);
                setId('');
              }
            }}
          >
            Register sensor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
