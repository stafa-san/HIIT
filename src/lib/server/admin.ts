/**
 * Firebase Admin (server + scripts). Never import from client components.
 *
 * Credentials, in order:
 *  1. FIRESTORE_EMULATOR_HOST set → emulator, no credentials needed.
 *  2. FIREBASE_SERVICE_ACCOUNT_KEY → the full service-account JSON as one
 *     string (Vercel env var). Firebase Console → Project settings → Service
 *     accounts → Generate new private key.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { Change } from '@/lib/domain/changes';
import { toWriteOps } from '@/lib/data/write-ops';

let app: App | undefined;

export function adminConfigured(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
}

export function getAdminDb(): Firestore {
  if (!app) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    if (getApps().length) {
      app = getApps()[0];
    } else if (process.env.FIRESTORE_EMULATOR_HOST) {
      app = initializeApp({ projectId: projectId || 'demo-hitt' });
    } else {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set.');
      const account = JSON.parse(raw) as { project_id?: string };
      app = initializeApp({ credential: cert(account as Parameters<typeof cert>[0]), projectId: projectId || account.project_id });
    }
  }
  return getFirestore(app);
}

/** Commit Change[] as atomic batches (≤ 450 writes each). */
export async function commitAdmin(db: Firestore, teamId: string, changes: Change[]): Promise<void> {
  const ops = toWriteOps(changes, teamId, (by) => FieldValue.increment(by));
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) {
      const ref = db.doc(op.path);
      if (op.op === 'set') batch.set(ref, op.data);
      else batch.update(ref, op.data);
    }
    await batch.commit();
  }
}
