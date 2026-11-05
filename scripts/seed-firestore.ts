/**
 * npm run seed — load the demo season into Firestore (reads .env.local).
 *
 * Wipes teams/{NEXT_PUBLIC_HITT_TEAM_ID} first, then writes ~260 documents.
 * Timestamps are relative to now, so re-run it right before a demo to get a
 * fresh "live game" (#54 Carter's 96 g alert, 0:42 ago).
 *
 * Needs FIREBASE_SERVICE_ACCOUNT_KEY (or FIRESTORE_EMULATOR_HOST).
 */
import { TEAM_ID } from '@/lib/config';
import { adminConfigured, getAdminDb } from '@/lib/server/admin';
import { seedTeam } from './seed-lib';

async function main() {
  if (!adminConfigured()) {
    console.error('Set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local (or FIRESTORE_EMULATOR_HOST for the emulator).');
    process.exit(1);
  }
  const target = process.env.FIRESTORE_EMULATOR_HOST ? `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : `project ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '(from service account)'}`;
  console.log(`Seeding teams/${TEAM_ID} on ${target}…`);
  const writes = await seedTeam(getAdminDb(), TEAM_ID);
  console.log(`Done — ${writes} documents written.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
