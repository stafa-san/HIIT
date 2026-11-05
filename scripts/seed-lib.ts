import type { Firestore } from 'firebase-admin/firestore';
import { teamPath } from '@/lib/data/write-ops';
import type { Change } from '@/lib/domain/changes';
import { generateDemoSnapshot } from '@/lib/demo/seed';
import { commitAdmin } from '@/lib/server/admin';

/** Wipe teams/{teamId} and write a fresh demo season. Returns the write count. */
export async function seedTeam(db: Firestore, teamId: string, now = Date.now()): Promise<number> {
  await db.recursiveDelete(db.doc(teamPath(teamId)));
  const snap = generateDemoSnapshot(now);
  await db.doc(teamPath(teamId)).set({ ...snap.team, id: teamId });
  const changes: Change[] = [
    ...snap.players.map((d): Change => ({ kind: 'set', collection: 'players', id: d.id, data: d })),
    ...snap.sensors.map((d): Change => ({ kind: 'set', collection: 'sensors', id: d.id, data: d })),
    ...snap.sessions.map((d): Change => ({ kind: 'set', collection: 'sessions', id: d.id, data: d })),
    ...snap.impacts.map((d): Change => ({ kind: 'set', collection: 'impacts', id: d.id, data: d })),
  ];
  await commitAdmin(db, teamId, changes);
  return changes.length + 1;
}
