import { create } from 'zustand';
import { DATA_MODE, type DataMode } from '@/lib/config';
import type { RepositoryState } from '@/lib/data/repository';

interface HittStore extends RepositoryState {
  mode: DataMode;
}

/** Mirror of the active repository's state. Written only by <DataProvider>. */
export const useHittStore = create<HittStore>(() => ({
  status: 'loading',
  snapshot: null,
  error: null,
  mode: DATA_MODE,
}));
