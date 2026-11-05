import { periodLabel, WEEK_MS, weekStart } from './clock';
import { isRtpActive } from './rtp';
import type {
  Impact,
  ImpactLevel,
  Player,
  Sensor,
  Session,
  SessionType,
  Snapshot,
  Team,
} from './types';

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export function classifyImpact(linearG: number, team: Pick<Team, 'alertThresholdG' | 'watchThresholdG'>): ImpactLevel {
  if (linearG >= team.alertThresholdG) return 'alert';
  if (linearG >= team.watchThresholdG) return 'watch';
  return 'logged';
}

export function playerName(player: Pick<Player, 'firstName' | 'lastName'>): string {
  return `${player.firstName} ${player.lastName}`;
}

/** "J. Carter" */
export function playerShortName(player: Pick<Player, 'firstName' | 'lastName'>): string {
  return `${player.firstName.charAt(0)}. ${player.lastName}`;
}

export function indexById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function liveSession(snap: Snapshot): Session | null {
  if (!snap.team.liveSessionId) return null;
  return snap.sessions.find((s) => s.id === snap.team.liveSessionId) ?? null;
}

const byNewest = (a: Impact, b: Impact) => b.at - a.at;

export function sessionImpacts(snap: Snapshot, sessionId: string | null | undefined): Impact[] {
  if (!sessionId) return [];
  return snap.impacts.filter((i) => i.sessionId === sessionId).sort(byNewest);
}

/** Alert-level impacts that count toward a player's history (not excluded). */
export function isCountedAlert(impact: Impact): boolean {
  return impact.level === 'alert' && impact.evaluation?.outcome !== 'excluded';
}

export function isUnresolvedAlert(impact: Impact): boolean {
  return impact.level === 'alert' && impact.evaluation !== null && impact.evaluation.status !== 'resolved';
}

/* ------------------------------------------------------------------ */
/* Live session: roster, alerts, stats                                 */
/* ------------------------------------------------------------------ */

export type PlayerStatus = 'out' | 'alert' | 'eval' | 'watch' | 'offline' | 'ok';

export const STATUS_RANK: Record<PlayerStatus, number> = {
  alert: 0,
  eval: 1,
  watch: 2,
  out: 3,
  ok: 4,
  offline: 5,
};

export interface RosterEntry {
  player: Player;
  sensor: Sensor;
  status: PlayerStatus;
  hits: number;
  lastImpact: Impact | null;
  peakImpact: Impact | null;
  /** Newest unresolved alert in the live session. */
  openAlert: Impact | null;
}

/** Active players wearing an active sensor, with their live-session status. */
export function rosterEntries(snap: Snapshot): RosterEntry[] {
  const session = liveSession(snap);
  const impacts = sessionImpacts(snap, session?.id);
  const sensors = indexById(snap.sensors);
  const entries: RosterEntry[] = [];

  for (const player of snap.players) {
    if (player.rosterStatus !== 'active' || !player.sensorId) continue;
    const sensor = sensors.get(player.sensorId);
    if (!sensor || sensor.status !== 'active') continue;

    const mine = impacts.filter((i) => i.playerId === player.id);
    const lastImpact = mine[0] ?? null;
    const peakImpact = mine.reduce<Impact | null>(
      (peak, i) => (peak === null || i.linearG > peak.linearG ? i : peak),
      null,
    );
    const openAlert = mine.find(isUnresolvedAlert) ?? null;

    let status: PlayerStatus;
    if (isRtpActive(player)) status = 'out';
    else if (openAlert) status = openAlert.evaluation?.status === 'evaluating' ? 'eval' : 'alert';
    else if (peakImpact && peakImpact.linearG >= snap.team.watchThresholdG) status = 'watch';
    else if (sensor.connection === 'offline') status = 'offline';
    else status = 'ok';

    entries.push({ player, sensor, status, hits: mine.length, lastImpact, peakImpact, openAlert });
  }
  return entries;
}

export type RosterSort = 'priority' | 'last-impact' | 'hits' | 'number';

export function sortRoster(entries: RosterEntry[], sort: RosterSort): RosterEntry[] {
  const copy = [...entries];
  const lastAt = (e: RosterEntry) => e.lastImpact?.at ?? 0;
  switch (sort) {
    case 'priority':
      return copy.sort(
        (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || lastAt(b) - lastAt(a),
      );
    case 'last-impact':
      return copy.sort((a, b) => lastAt(b) - lastAt(a) || a.player.number - b.player.number);
    case 'hits':
      return copy.sort((a, b) => b.hits - a.hits || a.player.number - b.player.number);
    case 'number':
      return copy.sort((a, b) => a.player.number - b.player.number);
  }
}

export function isFlagged(status: PlayerStatus): boolean {
  return status === 'alert' || status === 'eval' || status === 'watch' || status === 'out';
}

/** Unresolved live-session alerts, newest first. */
export function openAlerts(snap: Snapshot): Impact[] {
  const session = liveSession(snap);
  return sessionImpacts(snap, session?.id).filter(isUnresolvedAlert);
}

/** The alert the banner should show: newest one nobody has acknowledged. */
export function bannerAlert(snap: Snapshot): Impact | null {
  return openAlerts(snap).find((i) => i.evaluation?.acknowledgedAt === null) ?? null;
}

export interface DashboardStats {
  impacts: number;
  alerts: number;
  watchList: number;
  sensorsOffline: number;
  helmetsConnected: number;
  helmetsTotal: number;
}

export function dashboardStats(snap: Snapshot, roster = rosterEntries(snap)): DashboardStats {
  const session = liveSession(snap);
  const impacts = sessionImpacts(snap, session?.id);
  const offline = roster.filter((e) => e.sensor.connection === 'offline').length;
  return {
    impacts: impacts.length,
    alerts: impacts.filter(isCountedAlert).length,
    watchList: roster.filter((e) => e.status === 'watch').length,
    sensorsOffline: offline,
    helmetsConnected: roster.length - offline,
    helmetsTotal: roster.length,
  };
}

export interface ImpactBucket {
  label: string;
  count: number;
  hasAlert: boolean;
}

/** Game: impacts per quarter. Practice: impacts per 15 minutes. */
export function impactBuckets(session: Session, impacts: Impact[], now: number): ImpactBucket[] {
  if (session.clock) {
    const maxPeriod = Math.max(4, session.clock.period, ...impacts.map((i) => i.period ?? 1));
    return Array.from({ length: maxPeriod }, (_, idx) => {
      const period = idx + 1;
      const inPeriod = impacts.filter((i) => i.period === period);
      return {
        label: periodLabel(period),
        count: inPeriod.length,
        hasAlert: inPeriod.some(isCountedAlert),
      };
    });
  }
  const bucketMs = 15 * 60 * 1000;
  const end = session.endedAt ?? now;
  const count = Math.min(8, Math.max(4, Math.ceil((end - session.startedAt) / bucketMs)));
  const firstStart = Math.max(session.startedAt, end - count * bucketMs);
  return Array.from({ length: count }, (_, idx) => {
    const from = firstStart + idx * bucketMs;
    const to = from + bucketMs;
    const inBucket = impacts.filter((i) => i.at >= from && (idx === count - 1 ? true : i.at < to));
    const minutes = Math.round((from - session.startedAt) / 60_000);
    return {
      label: `${minutes}′`,
      count: inBucket.length,
      hasAlert: inBucket.some(isCountedAlert),
    };
  });
}

export interface PlayerSessionDetail {
  player: Player;
  sensor: Sensor | null;
  session: Session | null;
  impacts: Impact[];
  hits: number;
  peak: Impact | null;
  last: Impact | null;
  /** Newest alert-level impact this session (any status). */
  alert: Impact | null;
  buckets: ImpactBucket[];
}

export function playerSessionDetail(snap: Snapshot, playerId: string, now: number): PlayerSessionDetail | null {
  const player = snap.players.find((p) => p.id === playerId);
  if (!player) return null;
  const session = liveSession(snap);
  const impacts = sessionImpacts(snap, session?.id).filter((i) => i.playerId === playerId);
  const peak = impacts.reduce<Impact | null>(
    (best, i) => (best === null || i.linearG > best.linearG ? i : best),
    null,
  );
  return {
    player,
    sensor: snap.sensors.find((s) => s.id === player.sensorId) ?? null,
    session,
    impacts,
    hits: impacts.length,
    peak,
    last: impacts[0] ?? null,
    alert: impacts.find((i) => i.level === 'alert') ?? null,
    buckets: session ? impactBuckets(session, impacts, now) : [],
  };
}

/* ------------------------------------------------------------------ */
/* Season history                                                      */
/* ------------------------------------------------------------------ */

/** 1-based position of an alert among the player's counted season alerts. */
export function alertOrdinal(snap: Snapshot, impact: Impact): number | null {
  if (!isCountedAlert(impact)) return null;
  const alerts = snap.impacts
    .filter((i) => i.playerId === impact.playerId && isCountedAlert(i))
    .sort((a, b) => a.at - b.at);
  const index = alerts.findIndex((i) => i.id === impact.id);
  return index >= 0 ? index + 1 : null;
}

export interface WeekBucket {
  weekStart: number;
  practice: number;
  game: number;
  alert: boolean;
}

export interface SeasonSummary {
  seasonImpacts: number;
  alertHits: number;
  avgPeakG: number | null;
  sessionsLogged: number;
  weekly: WeekBucket[];
}

export function seasonSummary(snap: Snapshot, playerId: string, now: number): SeasonSummary {
  let hits = 0;
  let sumPeak = 0;
  let sessionsLogged = 0;
  const weeks = new Map<number, WeekBucket>();

  const sessions = [...snap.sessions].sort((a, b) => a.startedAt - b.startedAt);
  const firstWeek = sessions.length ? weekStart(sessions[0].startedAt) : weekStart(now);
  const lastWeek = weekStart(now);
  for (let w = firstWeek; w <= lastWeek; w = weekStart(w + WEEK_MS + 3_600_000)) {
    weeks.set(w, { weekStart: w, practice: 0, game: 0, alert: false });
  }

  for (const session of sessions) {
    const stats = session.playerStats[playerId];
    if (!stats || stats.hits === 0) continue;
    hits += stats.hits;
    sumPeak += stats.sumPeakG;
    sessionsLogged += 1;
    const bucket = weeks.get(weekStart(session.startedAt));
    if (bucket) bucket[session.type as SessionType] += stats.hits;
  }

  const counted = snap.impacts.filter((i) => i.playerId === playerId && isCountedAlert(i));
  for (const alert of counted) {
    const bucket = weeks.get(weekStart(alert.at));
    if (bucket) bucket.alert = true;
  }

  return {
    seasonImpacts: hits,
    alertHits: counted.length,
    avgPeakG: hits > 0 ? sumPeak / hits : null,
    sessionsLogged,
    weekly: [...weeks.values()],
  };
}

export type AlertLogStatus = 'pending' | 'evaluating' | 'protocol' | 'cleared' | 'excluded';

export interface AlertLogEntry {
  impact: Impact;
  session: Session | null;
  status: AlertLogStatus;
  note: string | null;
}

export function alertLog(snap: Snapshot, playerId: string): AlertLogEntry[] {
  const sessions = indexById(snap.sessions);
  return snap.impacts
    .filter((i) => i.playerId === playerId && i.level === 'alert')
    .sort(byNewest)
    .map((impact) => {
      const ev = impact.evaluation;
      let status: AlertLogStatus = 'pending';
      if (ev?.status === 'evaluating') status = 'evaluating';
      if (ev?.status === 'resolved' && ev.outcome) status = ev.outcome;
      return { impact, session: sessions.get(impact.sessionId) ?? null, status, note: ev?.note ?? null };
    });
}

/* ------------------------------------------------------------------ */
/* Sensor fleet                                                        */
/* ------------------------------------------------------------------ */

export type SensorState = 'assigned' | 'needs-reassign' | 'spare' | 'retired';

export interface SensorRow {
  sensor: Sensor;
  player: Player | null;
  state: SensorState;
}

export function sensorRows(snap: Snapshot): SensorRow[] {
  const players = indexById(snap.players);
  const rank: Record<SensorState, number> = { 'needs-reassign': 0, spare: 1, assigned: 2, retired: 3 };
  return snap.sensors
    .map((sensor) => {
      const player = sensor.playerId ? players.get(sensor.playerId) ?? null : null;
      let state: SensorState;
      if (sensor.status === 'retired') state = 'retired';
      else if (!player) state = 'spare';
      else if (player.rosterStatus !== 'active') state = 'needs-reassign';
      else state = 'assigned';
      return { sensor, player, state };
    })
    .sort((a, b) => rank[a.state] - rank[b.state] || a.sensor.id.localeCompare(b.sensor.id));
}

export function fleetSummary(rows: SensorRow[]) {
  const live = rows.filter((r) => r.state !== 'retired');
  return {
    total: live.length,
    assigned: live.filter((r) => r.state === 'assigned' || r.state === 'needs-reassign').length,
    spare: live.filter((r) => r.state === 'spare').length,
    needsReassign: live.filter((r) => r.state === 'needs-reassign').length,
    offline: live.filter((r) => r.player && r.sensor.connection === 'offline').length,
    retired: rows.length - live.length,
  };
}

/** Active players with no sensor — candidates for a reassignment. */
export function playersWithoutSensor(snap: Snapshot): Player[] {
  return snap.players
    .filter((p) => p.rosterStatus === 'active' && !p.sensorId)
    .sort((a, b) => a.number - b.number);
}

/** Total recorded impacts on a player's record (prior seasons + this one). */
export function careerImpacts(snap: Snapshot, player: Player): number {
  let season = 0;
  for (const session of snap.sessions) season += session.playerStats[player.id]?.hits ?? 0;
  return player.archivedImpactCount + season;
}
