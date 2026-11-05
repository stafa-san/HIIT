import type { Firestore } from 'firebase-admin/firestore';
import { applyChanges, type Change } from '@/lib/domain/changes';
import { recordImpact, type ImpactInput } from '@/lib/domain/commands';
import type { Player, Sensor, Session, Snapshot, Team } from '@/lib/domain/types';
import { teamPath } from '@/lib/data/write-ops';
import { commitAdmin } from './admin';

export interface IngestResult {
  sensorId: string;
  kind: string;
  impactId?: string;
  level?: string;
}

/** Accepts the same field aliases as the serial protocol. */
export function normalizeReading(raw: unknown): ImpactInput {
  if (typeof raw !== 'object' || raw === null) throw new Error('Each reading must be an object.');
  const r = raw as Record<string, unknown>;
  const sensorId = r.sensorId ?? r.sensor ?? r.id;
  const linearG = Number(r.linearG ?? r.g ?? r.peak);
  const rot = r.rotationalRadS2 ?? r.rot ?? r.rotational;
  const at = r.at === undefined ? undefined : Number(r.at);
  if (typeof sensorId !== 'string' || !sensorId.trim()) throw new Error('Reading is missing "sensorId".');
  if (!Number.isFinite(linearG) || linearG <= 0) throw new Error('Reading is missing a positive "linearG" (or "g").');
  return {
    sensorId,
    linearG,
    rotationalRadS2: rot === undefined || rot === null ? null : Number(rot),
    at: at !== undefined && Number.isFinite(at) ? at : undefined,
  };
}

/**
 * Record readings from a network-connected sensor/gateway. Loads just what
 * recordImpact needs (team, roster, sensors, live session), runs the same
 * command the browser uses, and commits one batch.
 */
export async function ingestReadings(db: Firestore, teamId: string, readings: ImpactInput[], now = Date.now()): Promise<IngestResult[]> {
  const base = teamPath(teamId);
  const [teamSnap, playersSnap, sensorsSnap] = await Promise.all([
    db.doc(base).get(),
    db.collection(`${base}/players`).get(),
    db.collection(`${base}/sensors`).get(),
  ]);
  if (!teamSnap.exists) throw new Error(`Team "${teamId}" not found — run \`npm run seed\` first.`);
  const team = { ...(teamSnap.data() as Team), id: teamSnap.id };
  const sessions: Session[] = [];
  if (team.liveSessionId) {
    const live = await db.doc(`${base}/sessions/${team.liveSessionId}`).get();
    if (live.exists) sessions.push({ ...(live.data() as Session), id: live.id });
  }
  const snap: Snapshot = {
    team,
    players: playersSnap.docs.map((d) => ({ ...(d.data() as Player), id: d.id })),
    sensors: sensorsSnap.docs.map((d) => ({ ...(d.data() as Sensor), id: d.id })),
    sessions,
    impacts: [],
  };

  const all: Change[] = [];
  const results: IngestResult[] = [];
  for (const reading of readings) {
    const outcome = recordImpact(snap, reading, now);
    applyChanges(snap, outcome.changes); // later readings see new sessions/sensors
    all.push(...outcome.changes);
    results.push(
      outcome.kind === 'recorded'
        ? { sensorId: outcome.impact.sensorId, kind: outcome.kind, impactId: outcome.impact.id, level: outcome.impact.level }
        : { sensorId: outcome.sensorId, kind: outcome.kind },
    );
  }
  await commitAdmin(db, teamId, all);
  return results;
}
