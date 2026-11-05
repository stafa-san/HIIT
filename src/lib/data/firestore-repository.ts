import { signInAnonymously } from 'firebase/auth';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  where,
  writeBatch,
  type DocumentData,
  type FirestoreError,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Change } from '@/lib/domain/changes';
import type { Impact, Player, Sensor, Session, Snapshot, Team } from '@/lib/domain/types';
import { getFirebaseAuth, getFirebaseDb } from '@/lib/firebase';
import type { HittRepository, RepositoryState } from './repository';
import { teamPath, toWriteOps } from './write-ops';

type Part = 'team' | 'players' | 'sensors' | 'sessions' | 'liveImpacts' | 'alertImpacts';

const META = { includeMetadataChanges: true } as const;

function explain(error: FirestoreError | Error): string {
  const code: string = (error as { code?: string }).code ?? '';
  if (code === 'permission-denied') {
    return 'Firestore denied access. Enable Anonymous sign-in (Firebase Console → Authentication → Sign-in method) and deploy the rules with `npm run deploy:rules`.';
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'Anonymous sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/configuration-not-found') {
    return 'Firebase Authentication is not set up for this project yet. Open Firebase Console → Authentication → Get started, then enable Anonymous sign-in.';
  }
  return error.message || 'Could not reach Firestore.';
}

const docs = <T>(snap: QuerySnapshot<DocumentData>) =>
  new Map(snap.docs.map((d) => [d.id, { ...d.data(), id: d.id } as T]));

/**
 * Firestore-backed store. Signs in anonymously, then listens to:
 *   teams/{teamId}, players, sensors, sessions,
 *   impacts where sessionId == liveSessionId, impacts where level == 'alert'.
 * Writes go through one atomic batch per command; Firestore's latency
 * compensation makes them appear instantly on this device.
 */
export class FirestoreRepository implements HittRepository {
  readonly mode = 'firebase' as const;
  private state: RepositoryState = { status: 'loading', snapshot: null, error: null };
  private listeners = new Set<(state: RepositoryState) => void>();
  private started = false;
  private unsubs: Array<() => void> = [];
  private liveUnsub: (() => void) | null = null;
  private liveSessionId: string | null | undefined = undefined;
  /** Parts confirmed by the server (not just the local cache). */
  private loaded = new Set<Part>();
  /** Parts that have produced any snapshot, cached or not. */
  private received = new Set<Part>();
  /** After a few seconds offline, render whatever the cache has. */
  private acceptCache = false;

  private team: Team | null = null;
  private players = new Map<string, Player>();
  private sensors = new Map<string, Sensor>();
  private sessions = new Map<string, Session>();
  private liveImpacts = new Map<string, Impact>();
  private alertImpacts = new Map<string, Impact>();

  constructor(private teamId: string) {}

  getState() {
    return this.state;
  }

  subscribe(listener: (state: RepositoryState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    if (!this.started) {
      this.started = true;
      void this.start();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  async commit(changes: Change[]) {
    if (changes.length === 0) return;
    const db = getFirebaseDb();
    const batch = writeBatch(db);
    for (const op of toWriteOps(changes, this.teamId, (by) => increment(by))) {
      const ref = doc(db, op.path);
      if (op.op === 'set') batch.set(ref, op.data);
      else batch.update(ref, op.data);
    }
    await batch.commit();
  }

  private async start() {
    try {
      const auth = getFirebaseAuth();
      if (!auth.currentUser) await signInAnonymously(auth);
    } catch (error) {
      this.fail(error as Error);
      return;
    }
    const db = getFirebaseDb();
    const base = teamPath(this.teamId);
    const onError = (error: FirestoreError) => this.fail(error);

    this.unsubs.push(
      onSnapshot(
        doc(db, base),
        { includeMetadataChanges: true },
        (snap) => {
          if (!snap.exists()) {
            this.team = null;
            this.loaded.add('team');
            this.state = {
              status: 'empty',
              snapshot: null,
              error: `No data for team "${this.teamId}" yet. Run \`npm run seed\` to load the demo season.`,
            };
            this.emit();
            return;
          }
          this.team = { ...(snap.data() as Team), id: snap.id };
          this.received.add('team');
          if (!snap.metadata.fromCache) this.loaded.add('team');
          this.watchLiveSession(this.team.liveSessionId);
          this.publish();
        },
        onError,
      ),
      onSnapshot(collection(db, base, 'players'), META, (s) => this.part('players', s, () => (this.players = docs<Player>(s))), onError),
      onSnapshot(collection(db, base, 'sensors'), META, (s) => this.part('sensors', s, () => (this.sensors = docs<Sensor>(s))), onError),
      onSnapshot(collection(db, base, 'sessions'), META, (s) => this.part('sessions', s, () => (this.sessions = docs<Session>(s))), onError),
      onSnapshot(
        query(collection(db, base, 'impacts'), where('level', '==', 'alert')),
        META,
        (s) => this.part('alertImpacts', s, () => (this.alertImpacts = docs<Impact>(s))),
        onError,
      ),
    );
    setTimeout(() => {
      this.acceptCache = true;
      this.publish();
    }, 4000);
  }

  private watchLiveSession(sessionId: string | null) {
    if (sessionId === this.liveSessionId) return;
    this.liveSessionId = sessionId;
    this.liveUnsub?.();
    this.liveUnsub = null;
    if (!sessionId) {
      this.liveImpacts = new Map();
      this.loaded.add('liveImpacts');
      this.received.add('liveImpacts');
      return;
    }
    this.loaded.delete('liveImpacts');
    this.received.delete('liveImpacts');
    const db = getFirebaseDb();
    this.liveUnsub = onSnapshot(
      query(collection(db, teamPath(this.teamId), 'impacts'), where('sessionId', '==', sessionId)),
      META,
      (s) => this.part('liveImpacts', s, () => (this.liveImpacts = docs<Impact>(s))),
      (error) => this.fail(error),
    );
  }

  private part(name: Part, snap: QuerySnapshot<DocumentData>, update: () => void) {
    update();
    this.received.add(name);
    // A brand-new query first answers from the local cache, which may only
    // hold documents other queries cached — wait for the server's answer.
    if (!snap.metadata.fromCache) this.loaded.add(name);
    this.publish();
  }

  private publish() {
    const all: Part[] = ['team', 'players', 'sensors', 'sessions', 'liveImpacts', 'alertImpacts'];
    const ready = this.acceptCache ? this.received : this.loaded;
    if (!this.team || !all.every((p) => ready.has(p))) return;
    const impacts = new Map(this.alertImpacts);
    for (const [id, impact] of this.liveImpacts) impacts.set(id, impact);
    const snapshot: Snapshot = {
      team: this.team,
      players: [...this.players.values()],
      sensors: [...this.sensors.values()],
      sessions: [...this.sessions.values()],
      impacts: [...impacts.values()],
    };
    this.state = { status: 'ready', snapshot, error: null };
    this.emit();
  }

  private fail(error: Error) {
    console.error('[hitt] firestore', error);
    this.state = { status: 'error', snapshot: this.state.snapshot, error: explain(error) };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }
}
