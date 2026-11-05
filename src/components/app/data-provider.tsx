'use client';

import { useEffect } from 'react';
import { getRepository } from '@/lib/data';
import { useHittStore } from '@/store/hitt-store';

/** Connects the active repository (demo or Firestore) to the zustand store. */
export function DataProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void getRepository().then((repo) => {
      if (cancelled) return;
      unsubscribe = repo.subscribe((state) => useHittStore.setState(state));
    });
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  return <>{children}</>;
}
