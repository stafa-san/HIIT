import type { DataMode } from '@/lib/config';
import type { Change } from '@/lib/domain/changes';
import type { Snapshot } from '@/lib/domain/types';

export type RepositoryStatus = 'loading' | 'ready' | 'empty' | 'error';

export interface RepositoryState {
  status: RepositoryStatus;
  snapshot: Snapshot | null;
  error: string | null;
}

/**
 * Storage backend. The UI only ever reads snapshots and commits Change[]
 * produced by the pure commands in lib/domain/commands.ts.
 */
export interface HittRepository {
  readonly mode: DataMode;
  subscribe(listener: (state: RepositoryState) => void): () => void;
  getState(): RepositoryState;
  commit(changes: Change[]): Promise<void>;
  /** Demo mode only: regenerate the demo season. */
  reset?(): Promise<void>;
}
