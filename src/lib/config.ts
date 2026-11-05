/**
 * Runtime configuration. Everything here is public (NEXT_PUBLIC_*).
 *
 * Data mode:
 *  - "firebase" when the Firebase web config is present — Firestore is the
 *    source of truth and every device stays in sync in real time.
 *  - "demo" otherwise (or when forced with NEXT_PUBLIC_HITT_DATA_MODE=demo) —
 *    a generated season lives in this browser's localStorage; tabs in the
 *    same browser stay in sync.
 */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export type DataMode = 'demo' | 'firebase';

export function hasFirebaseConfig(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export const DATA_MODE: DataMode =
  process.env.NEXT_PUBLIC_HITT_DATA_MODE === 'demo' || !hasFirebaseConfig() ? 'demo' : 'firebase';

/** Firestore document under teams/ that this deployment reads and writes. */
export const TEAM_ID = process.env.NEXT_PUBLIC_HITT_TEAM_ID || 'demo-varsity';

/** Point the client SDK at local emulators (`npm run emulators`). */
export const USE_EMULATORS = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true';
