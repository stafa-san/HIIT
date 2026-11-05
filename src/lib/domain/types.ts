/**
 * H.I.T.T. domain model.
 *
 * These shapes are shared verbatim by the in-browser demo store, the Firestore
 * documents (teams/{teamId}/{collection}/{id}), the ingest API and the seed
 * script. Timestamps are epoch milliseconds everywhere — no Firestore
 * Timestamp objects — so the same object works in every runtime.
 */

export type SessionType = 'game' | 'practice';
export type ImpactLevel = 'alert' | 'watch' | 'logged';
export type RosterStatus = 'active' | 'graduated' | 'inactive';
export type ClassYear = 'Fr.' | 'So.' | 'Jr.' | 'Sr.';

export interface Team {
  id: string;
  /** e.g. "Varsity" */
  name: string;
  school: string;
  season: number;
  /** Impacts at or above this peak linear acceleration raise an alert. */
  alertThresholdG: number;
  /** Players whose session peak reaches this go on the watch list. */
  watchThresholdG: number;
  physicianName: string;
  /** The session currently being recorded, if any. */
  liveSessionId: string | null;
}

export interface RtpStepState {
  startedAt: number | null;
  completedAt: number | null;
}

export interface ReturnToPlay {
  startedAt: number;
  /** The alert-level impact that started the protocol. */
  alertImpactId: string | null;
  /** 1-6. When `completedAt` is set the protocol is finished. */
  currentStep: number;
  steps: Record<string, RtpStepState>;
  clearance: {
    status: 'pending' | 'granted';
    physician: string | null;
    grantedAt: number | null;
  };
  completedAt: number | null;
}

export interface Player {
  id: string;
  number: number;
  firstName: string;
  lastName: string;
  /** Short code, e.g. "LB" */
  position: string;
  classYear: ClassYear;
  rosterStatus: RosterStatus;
  /** Free-form roster note, e.g. "New helmet issued", "Transfer". */
  note: string | null;
  sensorId: string | null;
  /** Impacts recorded in prior seasons (kept on the player record). */
  archivedImpactCount: number;
  rtp: ReturnToPlay | null;
}

export interface SensorAssignment {
  playerId: string | null;
  from: number;
  to: number | null;
  reason: string | null;
}

export interface Sensor {
  /** Printed hardware ID, e.g. "HT-0137". Also the document ID. */
  id: string;
  playerId: string | null;
  status: 'active' | 'retired';
  connection: 'online' | 'offline';
  battery: number | null;
  firmware: string;
  mount: 'crown';
  lastSeenAt: number | null;
  registeredAt: number;
  /** Set while a "test tap" is being verified during installation. */
  testStartedAt: number | null;
  lastTestTap: { at: number; linearG: number } | null;
  history: SensorAssignment[];
}

export interface PlayerSessionStats {
  hits: number;
  /** Sum of each hit's peak linear g — avg peak = sumPeakG / hits. */
  sumPeakG: number;
}

export interface SessionClock {
  /** Quarter, 1-4 (5 = OT). */
  period: number;
  /** Seconds left when the clock last started/stopped. */
  remainingSec: number;
  /** Epoch ms the clock started running; null while stopped. */
  runningSince: number | null;
}

export interface Session {
  id: string;
  type: SessionType;
  /** e.g. "Varsity vs. Ridgeview" or "Practice · tackling drill" */
  label: string;
  opponent: string | null;
  startedAt: number;
  endedAt: number | null;
  clock: SessionClock | null;
  /**
   * Per-player aggregates. Every impact increments these, so season history
   * never has to read individual impact documents.
   */
  playerStats: Record<string, PlayerSessionStats>;
}

export type EvaluationStatus = 'open' | 'evaluating' | 'resolved';
export type EvaluationOutcome = 'cleared' | 'protocol' | 'excluded';

export interface EvaluationChecklist {
  removed: boolean;
  assessed: boolean;
  physicianNotified: boolean;
}

export interface Evaluation {
  status: EvaluationStatus;
  acknowledgedAt: number | null;
  checklist: EvaluationChecklist;
  outcome: EvaluationOutcome | null;
  note: string | null;
  resolvedAt: number | null;
}

export interface Impact {
  id: string;
  sessionId: string;
  playerId: string;
  sensorId: string;
  at: number;
  linearG: number;
  rotationalRadS2: number | null;
  period: number | null;
  /** Game clock at the hit ("08:42"), or elapsed practice time. */
  clockLabel: string | null;
  level: ImpactLevel;
  /** Present on alert-level impacts only. */
  evaluation: Evaluation | null;
}

/** Everything the UI renders from. */
export interface Snapshot {
  team: Team;
  players: Player[];
  sensors: Sensor[];
  sessions: Session[];
  /** Live-session impacts plus every alert-level impact of the season. */
  impacts: Impact[];
}

export type CollectionName = 'players' | 'sensors' | 'sessions' | 'impacts';
