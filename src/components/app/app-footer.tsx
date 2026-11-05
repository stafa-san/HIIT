'use client';

import { useHittStore } from '@/store/hitt-store';

export function AppFooter({ note }: { note?: string }) {
  const mode = useHittStore((s) => s.mode);
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-6">
        <span>{note ?? 'H.I.T.T. flags high-magnitude impacts for evaluation by a qualified professional. It does not diagnose concussion.'}</span>
        <span className="font-semibold">{mode === 'demo' ? 'Demo data' : 'Live · Firebase'}</span>
      </div>
    </footer>
  );
}
