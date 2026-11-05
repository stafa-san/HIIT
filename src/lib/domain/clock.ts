import type { Session, SessionClock } from './types';

/** Regulation high-school quarter length (NFHS): 12 minutes. */
export const PERIOD_SEC = 12 * 60;

export function periodLabel(period: number): string {
  return period > 4 ? 'OT' : `Q${period}`;
}

export function clockRemainingSec(clock: SessionClock, now: number): number {
  if (clock.runningSince === null) return clock.remainingSec;
  const elapsed = (now - clock.runningSince) / 1000;
  return Math.max(0, clock.remainingSec - elapsed);
}

/** 438 -> "07:18" */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Elapsed practice time: 2530 -> "42:10", 4000 -> "1:06:40" */
export function formatElapsed(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Header label: "Q3 · 07:18" for games, "Practice · 42:10" for practices. */
export function sessionClockLabel(session: Session, now: number): string {
  if (session.clock) {
    return `${periodLabel(session.clock.period)} · ${formatClock(clockRemainingSec(session.clock, now))}`;
  }
  const end = session.endedAt ?? now;
  return `Practice · ${formatElapsed((end - session.startedAt) / 1000)}`;
}

/** Period + clock stamped onto an impact at the moment it is recorded. */
export function impactClockStamp(
  session: Session,
  now: number,
): { period: number | null; clockLabel: string | null } {
  if (session.clock) {
    return {
      period: session.clock.period,
      clockLabel: formatClock(clockRemainingSec(session.clock, now)),
    };
  }
  return { period: null, clockLabel: formatElapsed((now - session.startedAt) / 1000) };
}

/** Monday 00:00 local time of the week containing `ts`. */
export function weekStart(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // days since Monday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;
