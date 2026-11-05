import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateDemoSnapshot } from '@/lib/demo/seed';
import { applyChanges, type Change } from './changes';
import * as cmd from './commands';
import { RTP_STEP_COUNT } from './rtp';
import { PeakDetector, parseSerialLine } from './serial';
import type { Snapshot } from './types';
import * as v from './views';

const NOW = new Date('2026-11-05T21:00:00').getTime(); // a Thursday night
const fresh = () => generateDemoSnapshot(NOW);
const apply = (snap: Snapshot, changes: Change[]) => applyChanges(snap, changes);
const pid = (snap: Snapshot, n: number) => snap.players.find((p) => p.number === n)!.id;

describe('demo seed mirrors the mockups', () => {
  const snap = fresh();
  const roster = v.rosterEntries(snap);
  const stats = v.dashboardStats(snap, roster);

  it('has the live game and session totals', () => {
    const live = v.liveSession(snap)!;
    assert.equal(live.label, 'Varsity vs. Ridgeview');
    assert.equal(stats.impacts, 134);
    assert.equal(stats.alerts, 1);
    assert.equal(stats.watchList, 2);
    assert.equal(stats.sensorsOffline, 2);
    assert.equal(stats.helmetsConnected, 22);
    assert.equal(stats.helmetsTotal, 24);
  });

  it('flags #54 with the 96 g banner alert', () => {
    const alert = v.bannerAlert(snap)!;
    assert.equal(alert.playerId, pid(snap, 54));
    assert.equal(alert.linearG, 96);
    assert.equal(alert.rotationalRadS2, 5400);
    assert.equal(alert.clockLabel, '08:42');
    assert.equal(v.alertOrdinal(snap, alert), 3);
    const detail = v.playerSessionDetail(snap, pid(snap, 54), NOW)!;
    assert.equal(detail.hits, 14);
    assert.deepEqual(detail.buckets.map((b) => b.count), [4, 6, 4, 0]);
  });

  it('has the expected roster statuses', () => {
    const status = (n: number) => roster.find((e) => e.player.number === n)!.status;
    assert.equal(status(54), 'alert');
    assert.equal(status(22), 'watch');
    assert.equal(status(75), 'watch');
    assert.equal(status(12), 'offline');
    assert.equal(status(31), 'out');
    assert.equal(status(7), 'ok');
  });

  it('matches the player-history numbers for #54', () => {
    const season = v.seasonSummary(snap, pid(snap, 54), NOW);
    assert.equal(season.seasonImpacts, 294);
    assert.equal(season.alertHits, 3);
    assert.ok(season.avgPeakG! > 34 && season.avgPeakG! < 42, `avg ${season.avgPeakG}`);
    assert.equal(season.weekly.length, 12);
    assert.equal(season.weekly.filter((w) => w.alert).length, 3);
    const log = v.alertLog(snap, pid(snap, 54));
    assert.deepEqual(log.map((e) => e.status), ['pending', 'cleared', 'excluded', 'cleared']);
  });

  it('has the sensor fleet from the reassignment mockup', () => {
    const rows = v.sensorRows(snap);
    const fleet = v.fleetSummary(rows);
    assert.equal(fleet.needsReassign, 2);
    assert.equal(fleet.spare, 2);
    assert.equal(rows[0].sensor.id, 'HT-0142');
    const doyle = snap.players.find((p) => p.number === 80)!;
    assert.equal(v.careerImpacts(snap, doyle), 412);
    assert.deepEqual(v.playersWithoutSensor(snap).map((p) => p.number), [2, 19, 36, 67]);
  });

  it('has #31 mid-protocol at step 3', () => {
    const bell = snap.players.find((p) => p.number === 31)!;
    assert.equal(bell.rtp?.currentStep, 3);
    assert.ok(bell.rtp!.steps['2'].completedAt! < NOW);
  });

  it('is deterministic', () => {
    assert.deepEqual(generateDemoSnapshot(NOW), generateDemoSnapshot(NOW));
  });
});

describe('recordImpact', () => {
  it('records an alert-level hit and updates session aggregates', () => {
    const snap = fresh();
    const live = v.liveSession(snap)!;
    const before = live.playerStats[pid(snap, 7)].hits;
    const out = cmd.recordImpact(snap, { sensorId: 'ht-0129', linearG: 88.44 }, NOW + 1000);
    assert.equal(out.kind, 'recorded');
    apply(snap, out.changes);
    const impact = snap.impacts.find((i) => out.kind === 'recorded' && i.id === out.impact.id)!;
    assert.equal(impact.linearG, 88.4);
    assert.equal(impact.level, 'alert');
    assert.equal(impact.period, 3);
    assert.equal(impact.evaluation?.status, 'open');
    assert.equal(v.liveSession(snap)!.playerStats[pid(snap, 7)].hits, before + 1);
    // Newest unacknowledged alert takes the banner.
    assert.equal(v.bannerAlert(snap)!.id, impact.id);
    assert.equal(v.openAlerts(snap).length, 2);
  });

  it('auto-registers unknown sensors as spares', () => {
    const snap = fresh();
    const out = cmd.recordImpact(snap, { sensorId: 'HT-9001', linearG: 40 }, NOW);
    assert.equal(out.kind, 'registered-unknown-sensor');
    apply(snap, out.changes);
    const row = v.sensorRows(snap).find((r) => r.sensor.id === 'HT-9001')!;
    assert.equal(row.state, 'spare');
    assert.equal(row.sensor.connection, 'online');
  });

  it('ignores hits from sensors on inactive players but marks them online', () => {
    const snap = fresh();
    const out = cmd.recordImpact(snap, { sensorId: 'HT-0142', linearG: 90 }, NOW);
    assert.equal(out.kind, 'unassigned-sensor');
    const count = snap.impacts.length;
    apply(snap, out.changes);
    assert.equal(snap.impacts.length, count);
  });

  it('opens a practice session when nothing is live', () => {
    const snap = fresh();
    apply(snap, cmd.endSession(snap, NOW));
    assert.equal(v.liveSession(snap), null);
    const out = cmd.recordImpact(snap, { sensorId: 'HT-0137', linearG: 30 }, NOW + 5000);
    apply(snap, out.changes);
    const live = v.liveSession(snap)!;
    assert.equal(live.type, 'practice');
    assert.equal(live.playerStats[pid(snap, 54)].hits, 1);
  });

  it('captures a test tap instead of an impact', () => {
    const snap = fresh();
    apply(snap, cmd.beginSensorTest(snap, 'HT-0163', NOW));
    const out = cmd.recordImpact(snap, { sensorId: 'HT-0163', linearG: 12 }, NOW + 2000);
    assert.equal(out.kind, 'test-tap');
    apply(snap, out.changes);
    const sensor = snap.sensors.find((s) => s.id === 'HT-0163')!;
    assert.equal(sensor.testStartedAt, null);
    assert.equal(sensor.lastTestTap?.linearG, 12);
  });
});

describe('alert evaluation flow', () => {
  it('pull → checklist → protocol starts return-to-play', () => {
    const snap = fresh();
    const alert = v.bannerAlert(snap)!;
    apply(snap, cmd.pullForEvaluation(snap, alert.id, NOW));
    assert.equal(v.bannerAlert(snap), null, 'banner clears once pulled');
    const entry = () => v.rosterEntries(snap).find((e) => e.player.number === 54)!;
    assert.equal(entry().status, 'eval');

    apply(snap, cmd.setChecklistItem(snap, alert.id, 'assessed', true, NOW));
    apply(snap, cmd.setChecklistItem(snap, alert.id, 'physicianNotified', true, NOW));
    apply(snap, cmd.logOutcome(snap, alert.id, 'protocol', 'Removed from play, physician notified', NOW));
    assert.equal(entry().status, 'out');
    const carter = snap.players.find((p) => p.number === 54)!;
    assert.equal(carter.rtp?.currentStep, 1);
    assert.equal(carter.rtp?.alertImpactId, alert.id);
    assert.equal(v.alertLog(snap, carter.id)[0].status, 'protocol');
  });

  it('mark reviewed hides the banner but keeps the alert open', () => {
    const snap = fresh();
    const alert = v.bannerAlert(snap)!;
    apply(snap, cmd.acknowledgeAlert(snap, alert.id, NOW));
    assert.equal(v.bannerAlert(snap), null);
    assert.equal(v.openAlerts(snap).length, 1);
  });

  it('false alarm excludes the hit from counts', () => {
    const snap = fresh();
    const alert = v.bannerAlert(snap)!;
    apply(snap, cmd.markFalseAlarm(snap, alert.id, NOW));
    assert.equal(v.dashboardStats(snap).alerts, 0);
    assert.equal(v.seasonSummary(snap, alert.playerId, NOW).alertHits, 2);
    assert.equal(v.rosterEntries(snap).find((e) => e.player.number === 54)!.status, 'watch');
  });
});

describe('return to play', () => {
  it('requires clearance before full contact, then completes', () => {
    const snap = fresh();
    const bell = pid(snap, 31);
    apply(snap, cmd.completeRtpStep(snap, bell, NOW)); // 3 -> 4
    assert.throws(() => cmd.completeRtpStep(snap, bell, NOW), /clearance/);
    apply(snap, cmd.recordClearance(snap, bell, 'Dr. Elena Ruiz', NOW));
    for (let i = 4; i <= RTP_STEP_COUNT; i++) apply(snap, cmd.completeRtpStep(snap, bell, NOW + i));
    const player = snap.players.find((p) => p.id === bell)!;
    assert.ok(player.rtp?.completedAt);
    assert.equal(v.rosterEntries(snap).find((e) => e.player.id === bell)!.status, 'ok');
  });
});

describe('sensor fleet commands', () => {
  it('reassigns a sensor and keeps history on the old player', () => {
    const snap = fresh();
    const doyle = snap.players.find((p) => p.number === 80)!;
    const jalen = pid(snap, 36);
    apply(snap, cmd.reassignSensor(snap, 'HT-0142', jalen, 'Graduated', NOW));
    const sensor = snap.sensors.find((s) => s.id === 'HT-0142')!;
    assert.equal(sensor.playerId, jalen);
    assert.equal(snap.players.find((p) => p.id === jalen)!.sensorId, 'HT-0142');
    assert.equal(snap.players.find((p) => p.id === doyle.id)!.sensorId, null);
    assert.equal(sensor.history.at(-2)?.reason, 'Graduated');
    assert.equal(v.careerImpacts(snap, doyle), 412);
    assert.equal(v.fleetSummary(v.sensorRows(snap)).needsReassign, 1);
    assert.equal(v.rosterEntries(snap).length, 25);
  });

  it('refuses to double-assign a player', () => {
    const snap = fresh();
    assert.throws(() => cmd.reassignSensor(snap, 'HT-0163', pid(snap, 54), null, NOW), /already wears/);
  });

  it('retires and registers sensors', () => {
    const snap = fresh();
    apply(snap, cmd.retireSensor(snap, 'HT-0171', 'Cracked housing', NOW));
    assert.equal(v.sensorRows(snap).find((r) => r.sensor.id === 'HT-0171')!.state, 'retired');
    apply(snap, cmd.registerSensor(snap, 'ht-0200', { firmware: '1.4' }, NOW));
    assert.equal(snap.sensors.find((s) => s.id === 'HT-0200')!.firmware, '1.4');
    assert.throws(() => cmd.registerSensor(snap, 'HT-0200', {}, NOW), /already/);
    assert.throws(() => cmd.registerSensor(snap, 'bad', {}, NOW), /look like/);
  });
});

describe('sessions', () => {
  it('runs and stops the game clock', () => {
    const snap = fresh();
    const live = () => v.liveSession(snap)!;
    apply(snap, cmd.toggleClock(snap, NOW + 18_000)); // stop after 18s
    assert.equal(live().clock!.remainingSec, 420);
    apply(snap, cmd.nextPeriod(snap, NOW + 20_000));
    assert.equal(live().clock!.period, 4);
  });

  it('starts a new game and ends the old one', () => {
    const snap = fresh();
    const old = v.liveSession(snap)!.id;
    const { session, changes } = cmd.startSession(snap, { type: 'game', opponent: 'Lakota' }, NOW);
    apply(snap, changes);
    assert.equal(snap.team.liveSessionId, session.id);
    assert.equal(session.label, 'Varsity vs. Lakota');
    assert.ok(snap.sessions.find((s) => s.id === old)!.endedAt);
    assert.equal(v.dashboardStats(snap).impacts, 0);
  });
});

describe('serial protocol', () => {
  it('parses the supported line formats', () => {
    assert.deepEqual(parseSerialLine('{"id":"HT-0137","g":96.2,"rot":5400}'), { sensorId: 'HT-0137', value: 96.2, rotational: 5400 });
    assert.deepEqual(parseSerialLine('HT-0137,96.2,5400'), { sensorId: 'HT-0137', value: 96.2, rotational: 5400 });
    assert.deepEqual(parseSerialLine('ht-0137, 41'), { sensorId: 'HT-0137', value: 41, rotational: null });
    assert.deepEqual(parseSerialLine('id=HT-0137 g=96.2 rot=5400'), { sensorId: 'HT-0137', value: 96.2, rotational: 5400 });
    assert.deepEqual(parseSerialLine('96.2'), { sensorId: null, value: 96.2, rotational: null });
    assert.deepEqual(parseSerialLine('Force: 512'), { sensorId: null, value: 512, rotational: null });
    assert.deepEqual(parseSerialLine('71 g'), { sensorId: null, value: 71, rotational: null });
    assert.equal(parseSerialLine('Booting H.I.T.T. sensor...'), null);
    assert.equal(parseSerialLine(''), null);
    assert.equal(parseSerialLine('# comment'), null);
  });

  it('collapses a burst of samples into one impact at its peak', () => {
    const d = new PeakDetector({ triggerG: 10, quietMs: 100, refractoryMs: 200 });
    const s = (g: number) => ({ sensorId: null, linearG: g, rotational: null });
    assert.equal(d.push(s(3), 0), null);
    assert.equal(d.push(s(40), 10), null);
    assert.equal(d.push(s(92), 20), null);
    assert.equal(d.push(s(55), 30), null);
    assert.deepEqual(d.push(s(2), 40), { sensorId: null, linearG: 92, rotational: null });
    assert.equal(d.push(s(30), 100), null, 'refractory window ignores ringing');
    assert.equal(d.poll(400), null);
  });

  it('closes a single-sample burst after the quiet period', () => {
    const d = new PeakDetector({ triggerG: 10, quietMs: 100 });
    assert.equal(d.push({ sensorId: 'HT-0137', linearG: 64, rotational: 3500 }, 0), null);
    assert.equal(d.poll(50), null);
    assert.deepEqual(d.poll(120), { sensorId: 'HT-0137', linearG: 64, rotational: 3500 });
  });
});
