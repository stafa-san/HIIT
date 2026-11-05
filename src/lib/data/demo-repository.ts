import { applyChanges, type Change } from '@/lib/domain/changes';
import type { Snapshot } from '@/lib/domain/types';
import { generateDemoSnapshot } from '@/lib/demo/seed';
import type { HittRepository, RepositoryState } from './repository';

const STORAGE_KEY = 'hitt.demo.v1';
/** Regenerate when the stored demo has been idle this long (keeps "0:42 ago" fresh). */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

interface Stored {
  version: 1;
  savedAt: number;
  snapshot: Snapshot;
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed.version === 1 && parsed.snapshot?.team ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * In-browser store for demos without Firebase. Persists to localStorage and
 * listens for `storage` events, so the sideline tab and the /m phone tab in
 * the same browser stay in sync.
 */
export class DemoRepository implements HittRepository {
  readonly mode = 'demo' as const;
  private snapshot: Snapshot;
  private listeners = new Set<(state: RepositoryState) => void>();

  constructor() {
    const stored = readStored();
    if (stored && Date.now() - stored.savedAt < STALE_AFTER_MS) {
      this.snapshot = stored.snapshot;
    } else {
      this.snapshot = generateDemoSnapshot(Date.now());
      this.save();
    }
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readStored();
      if (next) {
        this.snapshot = next.snapshot;
        this.emit();
      }
    });
  }

  getState(): RepositoryState {
    return { status: 'ready', snapshot: this.snapshot, error: null };
  }

  subscribe(listener: (state: RepositoryState) => void) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async commit(changes: Change[]) {
    if (changes.length === 0) return;
    const next = structuredClone(this.snapshot);
    applyChanges(next, changes);
    this.snapshot = next;
    this.save();
    this.emit();
  }

  async reset() {
    this.snapshot = generateDemoSnapshot(Date.now());
    this.save();
    this.emit();
  }

  private save() {
    try {
      const stored: Stored = { version: 1, savedAt: Date.now(), snapshot: this.snapshot };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Private mode / quota — the demo still works for this tab.
    }
  }

  private emit() {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}
