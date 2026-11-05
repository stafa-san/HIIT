'use client';

import { AlertTriangle, Database, Loader2 } from 'lucide-react';
import type { Snapshot } from '@/lib/domain/types';
import { useHittStore } from '@/store/hitt-store';
import { cn } from '@/lib/utils';

/**
 * Renders children only once a snapshot is available; otherwise a loading,
 * empty or error panel. `tone="dark"` for the navy phone view.
 */
export function DataGate({
  children,
  tone = 'light',
}: {
  children: (snapshot: Snapshot) => React.ReactNode;
  tone?: 'light' | 'dark';
}) {
  const { status, snapshot, error } = useHittStore();
  if (snapshot && status !== 'empty') {
    return (
      <>
        {status === 'error' && error ? <ErrorStrip message={error} /> : null}
        {children(snapshot)}
      </>
    );
  }
  const dark = tone === 'dark';
  return (
    <div className={cn('flex min-h-[60vh] items-center justify-center p-6', dark && 'min-h-dvh bg-navy text-white')}>
      <div className={cn('max-w-md text-center', dark ? 'text-white/80' : 'text-muted-foreground')}>
        {status === 'loading' ? (
          <>
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
            <p className="text-sm">Connecting to helmets…</p>
          </>
        ) : (
          <>
            {status === 'empty' ? (
              <Database className="mx-auto mb-3 h-8 w-8" />
            ) : (
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-alert" />
            )}
            <p className={cn('mb-1 font-bold', dark ? 'text-white' : 'text-foreground')}>
              {status === 'empty' ? 'No team data yet' : 'Could not load data'}
            </p>
            <p className="text-sm">{error}</p>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorStrip({ message }: { message: string }) {
  return (
    <div className="no-print bg-alert px-4 py-2 text-center text-sm font-semibold text-white">{message}</div>
  );
}
