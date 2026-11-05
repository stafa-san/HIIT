'use client';

import { toast } from 'sonner';
import type { Change } from '@/lib/domain/changes';
import * as cmd from '@/lib/domain/commands';
import type { EvaluationChecklist, EvaluationOutcome, SessionType, Snapshot } from '@/lib/domain/types';
import { getRepository } from '@/lib/data';

/**
 * UI-facing actions: run a pure command against the current snapshot and
 * commit the result. Errors become toasts; the promise resolves to whether
 * the action succeeded.
 */
export async function dispatch(
  build: (snap: Snapshot, now: number) => Change[],
  success?: string,
): Promise<boolean> {
  try {
    const repo = await getRepository();
    const snap = repo.getState().snapshot;
    if (!snap) throw new Error('Data is still loading.');
    await repo.commit(build(snap, Date.now()));
    if (success) toast.success(success);
    return true;
  } catch (error) {
    toast.error((error as Error).message || 'Something went wrong.');
    return false;
  }
}

/** Record a sensor reading. Returns the outcome so callers can react. */
export async function ingestReading(input: cmd.ImpactInput): Promise<cmd.RecordOutcome | null> {
  try {
    const repo = await getRepository();
    const snap = repo.getState().snapshot;
    if (!snap) return null;
    const outcome = cmd.recordImpact(snap, input, Date.now());
    await repo.commit(outcome.changes);
    if (outcome.kind === 'registered-unknown-sensor') {
      toast.info(`New sensor ${outcome.sensorId} registered as a spare`, {
        description: 'Assign it to a player in Sensor management.',
      });
    } else if (outcome.kind === 'unassigned-sensor') {
      toast.warning(`${outcome.sensorId} is not assigned to an active player`, {
        description: 'Reading ignored. Reassign the sensor in Sensor management.',
      });
    } else if (outcome.kind === 'test-tap') {
      toast.success(`Test tap registered on ${outcome.sensorId}`);
    }
    return outcome;
  } catch (error) {
    toast.error((error as Error).message);
    return null;
  }
}

export const actions = {
  acknowledge: (id: string) => dispatch((s, now) => cmd.acknowledgeAlert(s, id, now), 'Alert marked reviewed'),
  pull: (id: string) => dispatch((s, now) => cmd.pullForEvaluation(s, id, now), 'Pulled for evaluation'),
  checklist: (id: string, item: keyof EvaluationChecklist, value: boolean) =>
    dispatch((s, now) => cmd.setChecklistItem(s, id, item, value, now)),
  outcome: (id: string, outcome: EvaluationOutcome, note: string | null) =>
    dispatch(
      (s, now) => cmd.logOutcome(s, id, outcome, note, now),
      outcome === 'protocol'
        ? 'Outcome logged — return-to-play protocol started'
        : outcome === 'cleared'
          ? 'Outcome logged — cleared to return'
          : 'Outcome logged — impact excluded',
    ),
  falseAlarm: (id: string) => dispatch((s, now) => cmd.markFalseAlarm(s, id, now), 'Marked as false alarm'),
  startRtp: (playerId: string) =>
    dispatch((s, now) => cmd.startReturnToPlay(s, playerId, now), 'Return-to-play protocol started'),
  completeRtpStep: (playerId: string, step: number) =>
    dispatch((s, now) => cmd.completeRtpStep(s, playerId, now), `Step ${step} logged complete`),
  clearance: (playerId: string, physician: string) =>
    dispatch((s, now) => cmd.recordClearance(s, playerId, physician, now), 'Medical clearance recorded'),
  reassign: (sensorId: string, playerId: string, reason: string | null, label: string) =>
    dispatch((s, now) => cmd.reassignSensor(s, sensorId, playerId, reason, now), `${sensorId} assigned to ${label}`),
  release: (sensorId: string, reason: string | null) =>
    dispatch((s, now) => cmd.releaseSensor(s, sensorId, reason, now), `${sensorId} returned to spares`),
  retire: (sensorId: string, reason: string | null) =>
    dispatch((s, now) => cmd.retireSensor(s, sensorId, reason, now), `${sensorId} retired`),
  reactivate: (sensorId: string) => dispatch((s) => cmd.reactivateSensor(s, sensorId), `${sensorId} back in service as a spare`),
  register: (id: string, firmware: string, battery: number | null) =>
    dispatch((s, now) => cmd.registerSensor(s, id, { firmware, battery }, now), `${id.toUpperCase()} registered`),
  beginTest: (sensorId: string) => dispatch((s, now) => cmd.beginSensorTest(s, sensorId, now)),
  cancelTest: (sensorId: string) => dispatch((s) => cmd.cancelSensorTest(s, sensorId)),
  thresholds: (alertG: number, watchG: number) =>
    dispatch((s) => cmd.setThresholds(s, alertG, watchG), 'Thresholds updated'),
  toggleClock: () => dispatch((s, now) => cmd.toggleClock(s, now)),
  nextPeriod: () => dispatch((s, now) => cmd.nextPeriod(s, now)),
  endSession: () => dispatch((s, now) => cmd.endSession(s, now), 'Session ended'),
  startSession: (type: SessionType, opponent: string, label: string) =>
    dispatch((s, now) => cmd.startSession(s, { type, opponent, label }, now).changes, 'Session started'),
  resetDemo: async () => {
    const repo = await getRepository();
    await repo.reset?.();
    toast.success('Demo data reset');
  },
};
