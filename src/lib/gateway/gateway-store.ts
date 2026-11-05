'use client';

import { create } from 'zustand';
import { ingestReading } from '@/lib/actions';
import { getRepositorySync } from '@/lib/data';
import { rosterEntries } from '@/lib/domain/views';
import { PeakDetector, parseSerialLine } from '@/lib/domain/serial';

/**
 * Sensor gateway — the laptop the Arduino is plugged into.
 *
 * Reads newline-delimited readings over Web Serial (Chrome/Edge desktop),
 * collapses bursts into single impacts and records them through the same
 * command path as everything else. In Firebase mode every other device sees
 * the hit within a second. Lives outside React so the connection survives
 * page navigation.
 */

export type GatewayStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface GatewayLogLine {
  id: number;
  at: number;
  kind: 'data' | 'impact' | 'info' | 'error';
  text: string;
}

interface GatewayState {
  status: GatewayStatus;
  error: string | null;
  baudRate: number;
  /** Sensor used for bare-number readings that carry no ID. */
  defaultSensorId: string | null;
  /** Multiply raw readings by this to get g (calibration). */
  scale: number;
  /** Ignore readings below this (g) — noise floor / burst trigger. */
  triggerG: number;
  log: GatewayLogLine[];
  forwarded: number;
  autoPlay: boolean;
}

export const useGateway = create<GatewayState>(() => ({
  status: 'idle',
  error: null,
  baudRate: 9600,
  defaultSensorId: null,
  scale: 1,
  triggerG: 10,
  log: [],
  forwarded: 0,
  autoPlay: false,
}));

let port: SerialPort | null = null;
let reader: ReadableStreamDefaultReader<string> | null = null;
let pollTimer: number | null = null;
let autoTimer: number | null = null;
let logSeq = 0;
const detector = new PeakDetector({ triggerG: 10, quietMs: 120, refractoryMs: 250 });

function log(kind: GatewayLogLine['kind'], text: string) {
  const line = { id: logSeq++, at: Date.now(), kind, text };
  useGateway.setState((s) => ({ log: [line, ...s.log].slice(0, 60) }));
}

export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && !!navigator.serial;
}

/** Bare readings go to the sensor under test (during install), else the default. */
function resolveSensor(explicit: string | null): string | null {
  if (explicit) return explicit;
  const snap = getRepositorySync()?.getState().snapshot;
  const testing = snap?.sensors.find((s) => s.testStartedAt !== null);
  return testing?.id ?? useGateway.getState().defaultSensorId;
}

async function forward(sensorId: string | null, linearG: number, rotational: number | null, source: string) {
  const id = resolveSensor(sensorId);
  if (!id) {
    log('error', `Impact ${linearG.toFixed(1)} g dropped — choose a default sensor for readings without an ID.`);
    return;
  }
  const outcome = await ingestReading({ sensorId: id, linearG, rotationalRadS2: rotational });
  if (outcome) {
    useGateway.setState((s) => ({ forwarded: s.forwarded + 1 }));
    log('impact', `${source} ${id} → ${linearG.toFixed(1)} g${rotational ? ` · ${rotational} rad/s²` : ''} (${outcome.kind})`);
  }
}

function handleLine(raw: string) {
  const reading = parseSerialLine(raw);
  if (!reading) {
    if (raw.trim()) log('info', raw.trim().slice(0, 120));
    return;
  }
  const { scale, triggerG } = useGateway.getState();
  const g = reading.value * scale;
  if (g >= triggerG) log('data', raw.trim().slice(0, 120));
  detector.setTrigger(triggerG);
  const impact = detector.push({ sensorId: reading.sensorId, linearG: g, rotational: reading.rotational }, Date.now());
  if (impact) void forward(impact.sensorId, impact.linearG, impact.rotational, 'USB');
}

export async function connectSerial() {
  if (!isSerialSupported()) {
    useGateway.setState({ status: 'error', error: 'Web Serial needs Chrome or Edge on a desktop/laptop.' });
    return;
  }
  try {
    useGateway.setState({ status: 'connecting', error: null });
    port = await navigator.serial!.requestPort();
    await port.open({ baudRate: useGateway.getState().baudRate });
    useGateway.setState({ status: 'connected' });
    const info = port.getInfo();
    log('info', `Connected${info.usbVendorId ? ` (USB ${info.usbVendorId.toString(16)}:${info.usbProductId?.toString(16)})` : ''} at ${useGateway.getState().baudRate} baud`);

    pollTimer = window.setInterval(() => {
      const impact = detector.poll(Date.now());
      if (impact) void forward(impact.sensorId, impact.linearG, impact.rotational, 'USB');
    }, 40);

    const decoder = new TextDecoderStream();
    void port.readable!.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => undefined);
    reader = decoder.readable.getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) handleLine(line);
    }
  } catch (error) {
    const message = (error as Error).message;
    if ((error as DOMException).name === 'NotFoundError') {
      useGateway.setState({ status: 'idle' }); // user closed the picker
      return;
    }
    log('error', message);
    useGateway.setState({ status: 'error', error: message });
  } finally {
    await cleanup();
  }
}

async function cleanup() {
  if (pollTimer !== null) window.clearInterval(pollTimer);
  pollTimer = null;
  try {
    await reader?.cancel();
  } catch {
    /* already closed */
  }
  reader = null;
  try {
    await port?.close();
  } catch {
    /* already closed */
  }
  if (port) log('info', 'Disconnected');
  port = null;
  if (useGateway.getState().status === 'connected' || useGateway.getState().status === 'connecting') {
    useGateway.setState({ status: 'idle' });
  }
}

export async function disconnectSerial() {
  await cleanup();
  useGateway.setState({ status: 'idle' });
}

/* ----------------------------- Simulator ----------------------------- */

function randomG(kind: 'routine' | 'watch' | 'alert' | 'mixed'): number {
  const r = Math.random();
  if (kind === 'alert') return 82 + Math.random() * 30;
  if (kind === 'watch') return 60 + Math.random() * 18;
  if (kind === 'routine') return 14 + Math.random() * 38;
  // mixed — what a real game looks like
  if (r < 0.8) return 14 + Math.random() * 38;
  if (r < 0.97) return 52 + Math.random() * 24;
  return 82 + Math.random() * 25;
}

/** Pick a connected, playing athlete's sensor (or use the given one). */
function pickSensor(sensorId?: string | null): string | null {
  if (sensorId) return sensorId;
  const snap = getRepositorySync()?.getState().snapshot;
  if (!snap) return null;
  const candidates = rosterEntries(snap).filter((e) => e.status !== 'out' && e.sensor.connection === 'online');
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)].sensor.id;
}

export async function simulateImpact(kind: 'routine' | 'watch' | 'alert' | 'mixed', sensorId?: string | null) {
  const id = pickSensor(sensorId);
  if (!id) {
    log('error', 'No connected sensor to simulate.');
    return;
  }
  const g = Math.round(randomG(kind) * 10) / 10;
  const rot = Math.round((g * (50 + Math.random() * 12)) / 10) * 10;
  await forward(id, g, rot, 'SIM');
}

export function setAutoPlay(on: boolean) {
  if (autoTimer !== null) window.clearTimeout(autoTimer);
  autoTimer = null;
  useGateway.setState({ autoPlay: on });
  if (!on) return;
  const tick = () => {
    void simulateImpact('mixed');
    autoTimer = window.setTimeout(tick, 2500 + Math.random() * 4000);
  };
  autoTimer = window.setTimeout(tick, 800);
}
