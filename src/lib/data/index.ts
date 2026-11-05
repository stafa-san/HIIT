import { DATA_MODE, TEAM_ID } from '@/lib/config';
import type { HittRepository } from './repository';

let repo: HittRepository | null = null;

/** Browser-only singleton. Firestore code is loaded only in firebase mode. */
export async function getRepository(): Promise<HittRepository> {
  if (repo) return repo;
  if (DATA_MODE === 'firebase') {
    const { FirestoreRepository } = await import('./firestore-repository');
    repo = new FirestoreRepository(TEAM_ID);
  } else {
    const { DemoRepository } = await import('./demo-repository');
    repo = new DemoRepository();
  }
  return repo;
}

export function getRepositorySync(): HittRepository | null {
  return repo;
}
