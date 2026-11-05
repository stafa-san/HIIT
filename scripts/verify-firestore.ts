/**
 * npm run verify:firestore — end-to-end check against the local emulators.
 *
 * Seeds the emulator with firebase-admin, then drives the real browser
 * repository (firebase/firestore client SDK, anonymous auth, security rules)
 * and the server ingest path, asserting the same numbers the UI shows.
 */
import assert from 'node:assert/strict';

process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= 'demo-key';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'demo-hitt';
process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= 'demo-app';
process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??= 'demo-hitt.firebaseapp.com';
process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS = 'true';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';

const TEAM = 'verify-team';

async function main() {
  const { getAdminDb } = await import('@/lib/server/admin');
  const { seedTeam } = await import('./seed-lib');
  const { FirestoreRepository } = await import('@/lib/data/firestore-repository');
  const cmd = await import('@/lib/domain/commands');
  const v = await import('@/lib/domain/views');
  const { ingestReadings } = await import('@/lib/server/ingest');
  const { DATA_MODE } = await import('@/lib/config');
  assert.equal(DATA_MODE, 'firebase');

  const db = getAdminDb();
  const writes = await seedTeam(db, TEAM);
  console.log(`✓ seeded ${writes} documents`);

  const repo = new FirestoreRepository(TEAM);
  type Snap = NonNullable<ReturnType<typeof repo.getState>['snapshot']>;
  const waitFor = (pred: (s: Snap) => boolean, label: string) =>
    new Promise<Snap>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${label} (${repo.getState().status} ${repo.getState().error ?? ''})`)), 10_000);
      const unsub = repo.subscribe((state) => {
        if (state.status === 'error') {
          clearTimeout(timer);
          reject(new Error(state.error ?? 'error'));
        }
        if (state.status === 'ready' && state.snapshot && pred(state.snapshot)) {
          clearTimeout(timer);
          queueMicrotask(() => unsub());
          resolve(state.snapshot);
        }
      });
    });

  let snap = await waitFor(() => true, 'initial load');
  const stats = v.dashboardStats(snap);
  assert.equal(stats.impacts, 134);
  assert.equal(stats.helmetsConnected, 22);
  assert.equal(v.bannerAlert(snap)?.linearG, 96);
  console.log('✓ client repository loads the seeded season (anonymous auth + rules)');

  // Record a hit from the browser gateway path.
  const hit = cmd.recordImpact(snap, { sensorId: 'HT-0129', linearG: 91, rotationalRadS2: 5100 }, Date.now());
  assert.equal(hit.kind, 'recorded');
  await repo.commit(hit.changes);
  snap = await waitFor((s) => v.dashboardStats(s).impacts === 135, 'new impact');
  assert.equal(v.dashboardStats(snap).alerts, 2);
  const okafor = snap.players.find((p) => p.number === 7)!;
  assert.equal(v.liveSession(snap)!.playerStats[okafor.id].hits, 4, 'increment() on session aggregates');
  console.log('✓ browser-recorded impact syncs with increments');

  // Alert workflow → return-to-play.
  const alertId = hit.kind === 'recorded' ? hit.impact.id : '';
  await repo.commit(cmd.pullForEvaluation(snap, alertId, Date.now()));
  snap = await waitFor((s) => s.impacts.find((i) => i.id === alertId)?.evaluation?.status === 'evaluating', 'pull');
  await repo.commit(cmd.logOutcome(snap, alertId, 'protocol', 'verify', Date.now()));
  snap = await waitFor((s) => s.players.find((p) => p.number === 7)?.rtp?.currentStep === 1, 'rtp start');
  await repo.commit(cmd.completeRtpStep(snap, okafor.id, Date.now()));
  snap = await waitFor((s) => s.players.find((p) => p.number === 7)?.rtp?.currentStep === 2, 'rtp step');
  assert.ok(snap.players.find((p) => p.number === 7)!.rtp!.steps['1'].completedAt);
  console.log('✓ pull → outcome → return-to-play steps (dotted numeric map paths)');

  // Sensor reassignment.
  const jalen = snap.players.find((p) => p.number === 36)!;
  await repo.commit(cmd.reassignSensor(snap, 'HT-0142', jalen.id, 'Graduated', Date.now()));
  snap = await waitFor((s) => s.players.find((p) => p.number === 36)?.sensorId === 'HT-0142', 'reassign');
  assert.equal(snap.players.find((p) => p.number === 80)!.sensorId, null);
  console.log('✓ sensor reassignment');

  // Server ingest path (what /api/ingest calls).
  const results = await ingestReadings(db, TEAM, [
    { sensorId: 'HT-0142', linearG: 33 },
    { sensorId: 'HT-9999', linearG: 50 },
  ]);
  assert.deepEqual(results.map((r) => r.kind), ['recorded', 'registered-unknown-sensor']);
  snap = await waitFor((s) => v.dashboardStats(s).impacts === 136 && s.sensors.some((x) => x.id === 'HT-9999'), 'server ingest');
  console.log('✓ server ingest records hits and registers unknown sensors');

  // New session switches the live-impacts listener.
  await repo.commit(cmd.startSession(snap, { type: 'practice' }, Date.now()).changes);
  snap = await waitFor((s) => v.liveSession(s)?.type === 'practice' && v.dashboardStats(s).impacts === 0, 'new session');
  assert.equal(v.alertLog(snap, okafor.id).length, 1, 'season alerts still visible after session change');
  console.log('✓ starting a session re-subscribes live impacts; season alerts persist');

  console.log('\nAll Firestore checks passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('✗', error);
  process.exit(1);
});
