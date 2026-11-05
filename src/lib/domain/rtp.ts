import type { Player, ReturnToPlay } from './types';

/**
 * Graduated return-to-play progression (CDC HEADS UP / Berlin consensus).
 * Each step normally takes at least 24 hours; full contact requires written
 * medical clearance. H.I.T.T. records the steps — the athletic trainer and a
 * licensed healthcare provider make the decisions.
 */
export const RTP_STEPS = [
  { n: 1, title: 'Symptom-limited activity', detail: 'Daily activities that do not provoke symptoms.' },
  { n: 2, title: 'Light aerobic exercise', detail: 'Walking or stationary bike at slow to medium pace.' },
  { n: 3, title: 'Sport-specific exercise', detail: 'Running drills. No head-impact activities.' },
  { n: 4, title: 'Non-contact training drills', detail: 'Harder drills, e.g. passing. May add resistance training.' },
  { n: 5, title: 'Full-contact practice', detail: 'Normal training activities.', requiresClearance: true },
  { n: 6, title: 'Return to play', detail: 'Normal game play.' },
] as const;

export const RTP_STEP_COUNT = RTP_STEPS.length;
export const MIN_HOURS_PER_STEP = 24;

export function newReturnToPlay(now: number, alertImpactId: string | null): ReturnToPlay {
  const steps: ReturnToPlay['steps'] = {};
  for (const step of RTP_STEPS) {
    steps[String(step.n)] = { startedAt: step.n === 1 ? now : null, completedAt: null };
  }
  return {
    startedAt: now,
    alertImpactId,
    currentStep: 1,
    steps,
    clearance: { status: 'pending', physician: null, grantedAt: null },
    completedAt: null,
  };
}

export function isRtpActive(player: Pick<Player, 'rtp'>): boolean {
  return player.rtp !== null && player.rtp.completedAt === null;
}

export type StepState = 'complete' | 'current' | 'upcoming';

export function stepState(rtp: ReturnToPlay, n: number): StepState {
  if (rtp.steps[String(n)]?.completedAt) return 'complete';
  if (rtp.completedAt === null && rtp.currentStep === n) return 'current';
  return 'upcoming';
}

/** Whether the current step may be logged complete, and why not if blocked. */
export function canCompleteCurrentStep(rtp: ReturnToPlay): { ok: boolean; reason: string | null } {
  if (rtp.completedAt !== null) return { ok: false, reason: 'Protocol already complete.' };
  // Finishing step 4 moves the athlete into full contact.
  if (rtp.currentStep >= 4 && rtp.clearance.status !== 'granted') {
    return {
      ok: false,
      reason: 'Medical clearance is required before full-contact practice.',
    };
  }
  return { ok: true, reason: null };
}

/** Hours since the current step started — steps are normally ≥ 24 h apart. */
export function hoursInCurrentStep(rtp: ReturnToPlay, now: number): number | null {
  const started = rtp.steps[String(rtp.currentStep)]?.startedAt;
  return started ? (now - started) / 3_600_000 : null;
}
