/**
 * Sensor serial protocol — what the Arduino prints, one reading per line.
 * Any of these work (see hardware/README.md):
 *
 *   {"id":"HT-0137","g":96.2,"rot":5400}      JSON
 *   HT-0137,96.2,5400                         CSV: id, linear g, rotational
 *   id=HT-0137 g=96.2 rot=5400                key=value
 *   96.2                                      bare number (uses default sensor)
 *
 * Bare numbers let the simplest possible sketch (`Serial.println(g)`) work.
 * Readings can be one-per-impact or a continuous stream — the PeakDetector
 * collapses a burst of samples above the trigger level into one impact.
 */

export interface SerialReading {
  sensorId: string | null;
  value: number;
  rotational: number | null;
}

const ID_RE = /\b([A-Za-z]{2}-\d{4})\b/;

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

export function parseSerialLine(raw: string): SerialReading | null {
  const line = raw.trim();
  if (!line || line.startsWith('#') || line.startsWith('//')) return null;

  // JSON
  if (line.startsWith('{')) {
    try {
      const obj = JSON.parse(line) as Record<string, unknown>;
      const value = num(obj.g ?? obj.linearG ?? obj.peak ?? obj.value ?? obj.raw);
      if (value === null) return null;
      const id = obj.id ?? obj.sensor ?? obj.sensorId;
      return {
        sensorId: typeof id === 'string' && id.trim() ? id.trim().toUpperCase() : null,
        value,
        rotational: num(obj.rot ?? obj.rotational ?? obj.rotationalRadS2),
      };
    } catch {
      return null;
    }
  }

  // key=value / key:value pairs
  if (/[=:]/.test(line) && /[a-z]/i.test(line)) {
    const pairs: Record<string, string> = {};
    for (const m of line.matchAll(/([A-Za-z_]+)\s*[=:]\s*([^\s,;]+)/g)) {
      pairs[m[1].toLowerCase()] = m[2];
    }
    const value = num(pairs.g ?? pairs.linearg ?? pairs.peak ?? pairs.value ?? pairs.force ?? pairs.raw);
    if (value !== null) {
      const id = pairs.id ?? pairs.sensor ?? pairs.sensorid;
      return {
        sensorId: id ? id.toUpperCase() : null,
        value,
        rotational: num(pairs.rot ?? pairs.rotational),
      };
    }
  }

  // CSV: ID,g[,rot]
  const parts = line.split(/[,;\t]/).map((p) => p.trim());
  if (parts.length >= 2 && ID_RE.test(parts[0])) {
    const value = num(parts[1]);
    if (value === null) return null;
    return { sensorId: parts[0].toUpperCase(), value, rotational: num(parts[2]) };
  }

  // Bare number (optionally labelled, e.g. "Force: 512")
  const bare = line.match(/^(?:[A-Za-z ]+[:=]?\s*)?(-?\d+(?:\.\d+)?)\s*(?:g)?$/i);
  if (bare) {
    const value = num(bare[1]);
    return value === null ? null : { sensorId: null, value, rotational: null };
  }
  return null;
}

export interface DetectedImpact {
  sensorId: string | null;
  linearG: number;
  rotational: number | null;
}

/**
 * Collapses a stream of samples into discrete impacts: a burst begins when a
 * sample reaches `triggerG`, tracks the peak, and ends after `quietMs` with
 * no sample above the trigger. A `refractoryMs` window then ignores ringing.
 * Time is injected so this is deterministic under test.
 */
export class PeakDetector {
  private burst: { sensorId: string | null; peak: number; rot: number | null; lastAt: number } | null = null;
  private refractoryUntil = 0;

  constructor(
    private opts: { triggerG: number; quietMs?: number; refractoryMs?: number },
  ) {}

  setTrigger(triggerG: number) {
    this.opts.triggerG = triggerG;
  }

  /** Feed one sample (already scaled to g). Returns an impact when a burst closes. */
  push(sample: DetectedImpact, at: number): DetectedImpact | null {
    const closed = this.poll(at);
    if (at < this.refractoryUntil) return closed;
    if (sample.linearG < this.opts.triggerG) return closed ?? this.close(at);

    if (this.burst && this.burst.sensorId !== sample.sensorId) {
      const out = this.close(at);
      this.burst = { sensorId: sample.sensorId, peak: sample.linearG, rot: sample.rotational, lastAt: at };
      return out;
    }
    if (!this.burst) {
      this.burst = { sensorId: sample.sensorId, peak: sample.linearG, rot: sample.rotational, lastAt: at };
    } else {
      if (sample.linearG > this.burst.peak) {
        this.burst.peak = sample.linearG;
        this.burst.rot = sample.rotational ?? this.burst.rot;
      }
      this.burst.lastAt = at;
    }
    return closed;
  }

  /** Call on a timer: closes a burst once the stream has gone quiet. */
  poll(at: number): DetectedImpact | null {
    return this.closeIfQuiet(at);
  }

  private closeIfQuiet(at: number): DetectedImpact | null {
    if (this.burst && at - this.burst.lastAt >= (this.opts.quietMs ?? 120)) return this.close(at);
    return null;
  }

  private close(at: number): DetectedImpact | null {
    if (!this.burst) return null;
    const out = { sensorId: this.burst.sensorId, linearG: this.burst.peak, rotational: this.burst.rot };
    this.burst = null;
    this.refractoryUntil = at + (this.opts.refractoryMs ?? 250);
    return out;
  }
}
