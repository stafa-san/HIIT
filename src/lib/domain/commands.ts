import { inc, type Change } from './changes';
import { impactClockStamp, PERIOD_SEC, clockRemainingSec } from './clock';
import { canCompleteCurrentStep, newReturnToPlay, RTP_STEP_COUNT } from './rtp';
import type {
  Evaluation,
  EvaluationChecklist,
  EvaluationOutcome,
  Impact,
  Player,
  Sensor,
  Session,
  SessionType,
  Snapshot,
} from './types';
import { classifyImpact, liveSession } from './views';

/**
 * Commands: (snapshot, args, now) -> Change[].
 *
 * Pure functions — they never touch storage. The repository (demo or
 * Firestore) applies the returned changes. Throwing a CommandError means the
 * action is not allowed in the current state; the UI shows the message.
 */

export class CommandError extends Error {}

export function newId(prefix: string, now: number): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${now.toString(36)}${rand}`;
}

function findPlayer(snap: Snapshot, id: string): Player {
  const player = snap.players.find((p) => p.id === id);
  if (!player) throw new CommandError(`Unknown player ${id}`);
  return player;
}

function findSensor(snap: Snapshot, id: string): Sensor {
  const sensor = snap.sensors.find((s) => s.id === id);
  if (!sensor) throw new CommandError(`Unknown sensor ${id}`);
  return sensor;
}

function findAlert(snap: Snapshot, id: string): Impact & { evaluation: Evaluation } {
  const impact = snap.impacts.find((i) => i.id === id);
  if (!impact || !impact.evaluation) throw new CommandError(`No alert ${id}`);
  return impact as Impact & { evaluation: Evaluation };
}

/* ------------------------------------------------------------------ */
/* Sensor readings                                                     */
/* ------------------------------------------------------------------ */

export interface ImpactInput {
  sensorId: string;
  linearG: number;
  rotationalRadS2?: number | null;
  /** Defaults to `now`. */
  at?: number;
}

export type RecordOutcome =
  | { kind: 'recorded'; impact: Impact; changes: Change[] }
  | { kind: 'test-tap'; sensorId: string; changes: Change[] }
  | { kind: 'registered-unknown-sensor'; sensorId: string; changes: Change[] }
  | { kind: 'unassigned-sensor'; sensorId: string; changes: Change[] }
  | { kind: 'retired-sensor'; sensorId: string; changes: Change[] };

export const SENSOR_ID_PATTERN = /^[A-Z]{2}-\d{4}$/;

export function newSensor(id: string, now: number, opts: Partial<Sensor> = {}): Sensor {
  return {
    id,
    playerId: null,
    status: 'active',
    connection: 'offline',
    battery: null,
    firmware: '1.3',
    mount: 'crown',
    lastSeenAt: null,
    registeredAt: now,
    testStartedAt: null,
    lastTestTap: null,
    history: [],
    ...opts,
  };
}

export function newEvaluation(): Evaluation {
  return {
    status: 'open',
    acknowledgedAt: null,
    checklist: { removed: false, assessed: false, physicianNotified: false },
    outcome: null,
    note: null,
    resolvedAt: null,
  };
}

function newPracticeSession(now: number): Session {
  return {
    id: newId('ses', now),
    type: 'practice',
    label: 'Practice',
    opponent: null,
    startedAt: now,
    endedAt: null,
    clock: null,
    playerStats: {},
  };
}

/**
 * Turn one sensor reading into writes. Unknown sensors are registered as
 * spares (so they show up in Sensor management), test taps are captured on
 * the sensor, and if no session is live a practice session is opened so a
 * hit is never silently dropped.
 */
export function recordImpact(snap: Snapshot, input: ImpactInput, now: number): RecordOutcome {
  const at = input.at ?? now;
  const sensorId = input.sensorId.trim().toUpperCase();
  const linearG = Math.round(input.linearG * 10) / 10;
  if (!Number.isFinite(linearG) || linearG <= 0) {
    throw new CommandError('Impact must have a positive linear acceleration.');
  }
  const heartbeat = { connection: 'online', lastSeenAt: at };

  const sensor = snap.sensors.find((s) => s.id === sensorId);
  if (!sensor) {
    const created = newSensor(sensorId, now, { connection: 'online', lastSeenAt: at });
    return {
      kind: 'registered-unknown-sensor',
      sensorId,
      changes: [{ kind: 'set', collection: 'sensors', id: sensorId, data: created }],
    };
  }
  if (sensor.status === 'retired') {
    return { kind: 'retired-sensor', sensorId, changes: [] };
  }
  if (sensor.testStartedAt !== null) {
    return {
      kind: 'test-tap',
      sensorId,
      changes: [
        {
          kind: 'update',
          collection: 'sensors',
          id: sensorId,
          fields: { ...heartbeat, testStartedAt: null, lastTestTap: { at, linearG } },
        },
      ],
    };
  }

  const player = sensor.playerId ? snap.players.find((p) => p.id === sensor.playerId) : undefined;
  if (!player || player.rosterStatus !== 'active') {
    return {
      kind: 'unassigned-sensor',
      sensorId,
      changes: [{ kind: 'update', collection: 'sensors', id: sensorId, fields: heartbeat }],
    };
  }

  const changes: Change[] = [];
  let session = liveSession(snap);
  if (!session) {
    session = newPracticeSession(now);
    changes.push({ kind: 'set', collection: 'sessions', id: session.id, data: session });
    changes.push({ kind: 'updateTeam', fields: { liveSessionId: session.id } });
  }

  const level = classifyImpact(linearG, snap.team);
  const stamp = impactClockStamp(session, at);
  const impact: Impact = {
    id: newId('imp', at),
    sessionId: session.id,
    playerId: player.id,
    sensorId,
    at,
    linearG,
    rotationalRadS2:
      input.rotationalRadS2 === undefined || input.rotationalRadS2 === null
        ? null
        : Math.round(input.rotationalRadS2),
    period: stamp.period,
    clockLabel: stamp.clockLabel,
    level,
    evaluation: level === 'alert' ? newEvaluation() : null,
  };

  changes.push(
    { kind: 'set', collection: 'impacts', id: impact.id, data: impact },
    {
      kind: 'update',
      collection: 'sessions',
      id: session.id,
      fields: {
        [`playerStats.${player.id}.hits`]: inc(1),
        [`playerStats.${player.id}.sumPeakG`]: inc(linearG),
      },
    },
    { kind: 'update', collection: 'sensors', id: sensorId, fields: heartbeat },
  );
  return { kind: 'recorded', impact, changes };
}

/* ------------------------------------------------------------------ */
/* Alert evaluation                                                    */
/* ------------------------------------------------------------------ */

function evalUpdate(id: string, fields: Record<string, unknown>): Change {
  const prefixed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) prefixed[`evaluation.${k}`] = v;
  return { kind: 'update', collection: 'impacts', id, fields: prefixed };
}

/** Banner "Mark reviewed": someone has seen it; outcome still to be logged. */
export function acknowledgeAlert(snap: Snapshot, impactId: string, now: number): Change[] {
  const alert = findAlert(snap, impactId);
  if (alert.evaluation.acknowledgedAt !== null) return [];
  return [evalUpdate(impactId, { acknowledgedAt: now })];
}

export function pullForEvaluation(snap: Snapshot, impactId: string, now: number): Change[] {
  const alert = findAlert(snap, impactId);
  if (alert.evaluation.status === 'resolved') {
    throw new CommandError('This alert already has an outcome logged.');
  }
  return [
    evalUpdate(impactId, {
      status: 'evaluating',
      'checklist.removed': true,
      acknowledgedAt: alert.evaluation.acknowledgedAt ?? now,
    }),
  ];
}

export function setChecklistItem(
  snap: Snapshot,
  impactId: string,
  item: keyof EvaluationChecklist,
  value: boolean,
  now: number,
): Change[] {
  const alert = findAlert(snap, impactId);
  const fields: Record<string, unknown> = { [`checklist.${item}`]: value };
  if (value && alert.evaluation.status === 'open') {
    fields.status = 'evaluating';
    fields.acknowledgedAt = alert.evaluation.acknowledgedAt ?? now;
  }
  return [evalUpdate(impactId, fields)];
}

export function logOutcome(
  snap: Snapshot,
  impactId: string,
  outcome: EvaluationOutcome,
  note: string | null,
  now: number,
): Change[] {
  const alert = findAlert(snap, impactId);
  const changes: Change[] = [
    evalUpdate(impactId, {
      status: 'resolved',
      outcome,
      note: note?.trim() || null,
      resolvedAt: now,
      acknowledgedAt: alert.evaluation.acknowledgedAt ?? now,
    }),
  ];
  if (outcome === 'protocol') {
    const player = findPlayer(snap, alert.playerId);
    if (!player.rtp || player.rtp.completedAt !== null) {
      changes.push({
        kind: 'update',
        collection: 'players',
        id: player.id,
        fields: { rtp: newReturnToPlay(now, impactId) },
      });
    }
  }
  return changes;
}

export function markFalseAlarm(snap: Snapshot, impactId: string, now: number): Change[] {
  return logOutcome(snap, impactId, 'excluded', 'Marked as false alarm', now);
}

/* ------------------------------------------------------------------ */
/* Return to play                                                      */
/* ------------------------------------------------------------------ */

export function startReturnToPlay(snap: Snapshot, playerId: string, now: number): Change[] {
  const player = findPlayer(snap, playerId);
  if (player.rtp && player.rtp.completedAt === null) {
    throw new CommandError('A return-to-play protocol is already in progress.');
  }
  return [{ kind: 'update', collection: 'players', id: playerId, fields: { rtp: newReturnToPlay(now, null) } }];
}

export function completeRtpStep(snap: Snapshot, playerId: string, now: number): Change[] {
  const player = findPlayer(snap, playerId);
  const rtp = player.rtp;
  if (!rtp) throw new CommandError('No return-to-play protocol in progress.');
  const gate = canCompleteCurrentStep(rtp);
  if (!gate.ok) throw new CommandError(gate.reason ?? 'Step cannot be completed yet.');

  const n = rtp.currentStep;
  const fields: Record<string, unknown> = { [`rtp.steps.${n}.completedAt`]: now };
  if (n >= RTP_STEP_COUNT) {
    fields['rtp.completedAt'] = now;
  } else {
    fields['rtp.currentStep'] = n + 1;
    fields[`rtp.steps.${n + 1}.startedAt`] = now;
  }
  return [{ kind: 'update', collection: 'players', id: playerId, fields }];
}

export function recordClearance(snap: Snapshot, playerId: string, physician: string, now: number): Change[] {
  const player = findPlayer(snap, playerId);
  if (!player.rtp) throw new CommandError('No return-to-play protocol in progress.');
  const name = physician.trim();
  if (!name) throw new CommandError('Enter the clearing physician.');
  return [
    {
      kind: 'update',
      collection: 'players',
      id: playerId,
      fields: { 'rtp.clearance': { status: 'granted', physician: name, grantedAt: now } },
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Sensor fleet                                                        */
/* ------------------------------------------------------------------ */

function closeHistory(sensor: Sensor, now: number, reason: string | null) {
  return sensor.history.map((h) => (h.to === null ? { ...h, to: now, reason: reason ?? h.reason } : h));
}

function releaseChanges(snap: Snapshot, sensor: Sensor): Change[] {
  if (!sensor.playerId) return [];
  const prev = snap.players.find((p) => p.id === sensor.playerId);
  if (!prev || prev.sensorId !== sensor.id) return [];
  return [{ kind: 'update', collection: 'players', id: prev.id, fields: { sensorId: null } }];
}

export function reassignSensor(
  snap: Snapshot,
  sensorId: string,
  toPlayerId: string,
  reason: string | null,
  now: number,
): Change[] {
  const sensor = findSensor(snap, sensorId);
  const target = findPlayer(snap, toPlayerId);
  if (sensor.status === 'retired') throw new CommandError(`${sensorId} is retired.`);
  if (target.rosterStatus !== 'active') throw new CommandError(`#${target.number} is not on the active roster.`);
  if (target.sensorId && target.sensorId !== sensorId) {
    throw new CommandError(`#${target.number} already wears ${target.sensorId}.`);
  }
  if (sensor.playerId === toPlayerId) return [];

  const history = [
    ...closeHistory(sensor, now, reason),
    { playerId: toPlayerId, from: now, to: null, reason: null },
  ];
  return [
    ...releaseChanges(snap, sensor),
    { kind: 'update', collection: 'players', id: toPlayerId, fields: { sensorId } },
    {
      kind: 'update',
      collection: 'sensors',
      id: sensorId,
      fields: { playerId: toPlayerId, history, testStartedAt: null },
    },
  ];
}

/** Take a sensor out of a helmet and back to the equipment room as a spare. */
export function releaseSensor(snap: Snapshot, sensorId: string, reason: string | null, now: number): Change[] {
  const sensor = findSensor(snap, sensorId);
  if (!sensor.playerId) return [];
  return [
    ...releaseChanges(snap, sensor),
    {
      kind: 'update',
      collection: 'sensors',
      id: sensorId,
      fields: { playerId: null, history: closeHistory(sensor, now, reason), testStartedAt: null },
    },
  ];
}

export function retireSensor(snap: Snapshot, sensorId: string, reason: string | null, now: number): Change[] {
  const sensor = findSensor(snap, sensorId);
  return [
    ...releaseChanges(snap, sensor),
    {
      kind: 'update',
      collection: 'sensors',
      id: sensorId,
      fields: {
        status: 'retired',
        playerId: null,
        connection: 'offline',
        testStartedAt: null,
        history: closeHistory(sensor, now, reason ?? 'Retired'),
      },
    },
  ];
}

export function reactivateSensor(snap: Snapshot, sensorId: string): Change[] {
  findSensor(snap, sensorId);
  return [{ kind: 'update', collection: 'sensors', id: sensorId, fields: { status: 'active' } }];
}

export function registerSensor(
  snap: Snapshot,
  id: string,
  opts: { firmware?: string; battery?: number | null },
  now: number,
): Change[] {
  const sensorId = id.trim().toUpperCase();
  if (!SENSOR_ID_PATTERN.test(sensorId)) {
    throw new CommandError('Sensor IDs look like HT-0142 (two letters, dash, four digits).');
  }
  if (snap.sensors.some((s) => s.id === sensorId)) {
    throw new CommandError(`${sensorId} is already registered.`);
  }
  const sensor = newSensor(sensorId, now, {
    firmware: opts.firmware?.trim() || '1.3',
    battery: opts.battery ?? null,
  });
  return [{ kind: 'set', collection: 'sensors', id: sensorId, data: sensor }];
}

export function beginSensorTest(snap: Snapshot, sensorId: string, now: number): Change[] {
  findSensor(snap, sensorId);
  return [{ kind: 'update', collection: 'sensors', id: sensorId, fields: { testStartedAt: now } }];
}

export function cancelSensorTest(snap: Snapshot, sensorId: string): Change[] {
  const sensor = findSensor(snap, sensorId);
  if (sensor.testStartedAt === null) return [];
  return [{ kind: 'update', collection: 'sensors', id: sensorId, fields: { testStartedAt: null } }];
}

/* ------------------------------------------------------------------ */
/* Team & sessions                                                     */
/* ------------------------------------------------------------------ */

export function setThresholds(snap: Snapshot, alertG: number, watchG: number): Change[] {
  if (!(alertG >= 40 && alertG <= 200)) throw new CommandError('Alert threshold must be 40–200 g.');
  if (!(watchG >= 20 && watchG < alertG)) {
    throw new CommandError('Watch threshold must be at least 20 g and below the alert threshold.');
  }
  return [{ kind: 'updateTeam', fields: { alertThresholdG: alertG, watchThresholdG: watchG } }];
}

function requireLive(snap: Snapshot): Session {
  const session = liveSession(snap);
  if (!session) throw new CommandError('No session is live.');
  return session;
}

export function toggleClock(snap: Snapshot, now: number): Change[] {
  const session = requireLive(snap);
  if (!session.clock) throw new CommandError('Practices do not have a game clock.');
  const running = session.clock.runningSince !== null;
  return [
    {
      kind: 'update',
      collection: 'sessions',
      id: session.id,
      fields: running
        ? { 'clock.remainingSec': Math.round(clockRemainingSec(session.clock, now)), 'clock.runningSince': null }
        : { 'clock.runningSince': now },
    },
  ];
}

export function nextPeriod(snap: Snapshot, now: number): Change[] {
  const session = requireLive(snap);
  if (!session.clock) throw new CommandError('Practices do not have quarters.');
  return [
    {
      kind: 'update',
      collection: 'sessions',
      id: session.id,
      fields: { clock: { period: session.clock.period + 1, remainingSec: PERIOD_SEC, runningSince: now } },
    },
  ];
}

export function endSession(snap: Snapshot, now: number): Change[] {
  const session = requireLive(snap);
  const fields: Record<string, unknown> = { endedAt: now };
  if (session.clock) {
    fields['clock.remainingSec'] = Math.round(clockRemainingSec(session.clock, now));
    fields['clock.runningSince'] = null;
  }
  return [
    { kind: 'update', collection: 'sessions', id: session.id, fields },
    { kind: 'updateTeam', fields: { liveSessionId: null } },
  ];
}

export function startSession(
  snap: Snapshot,
  opts: { type: SessionType; opponent?: string; label?: string },
  now: number,
): { session: Session; changes: Change[] } {
  const changes: Change[] = liveSession(snap) ? endSession(snap, now) : [];
  const opponent = opts.opponent?.trim() || null;
  const label =
    opts.label?.trim() ||
    (opts.type === 'game' ? `${snap.team.name} vs. ${opponent ?? 'Opponent'}` : 'Practice');
  const session: Session = {
    id: newId('ses', now),
    type: opts.type,
    label,
    opponent,
    startedAt: now,
    endedAt: null,
    clock: opts.type === 'game' ? { period: 1, remainingSec: PERIOD_SEC, runningSince: now } : null,
    playerStats: {},
  };
  changes.push(
    { kind: 'set', collection: 'sessions', id: session.id, data: session },
    { kind: 'updateTeam', fields: { liveSessionId: session.id } },
  );
  return { session, changes };
}
