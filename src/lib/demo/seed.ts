import { DAY_MS, formatClock, PERIOD_SEC, weekStart } from '@/lib/domain/clock';
import { newSensor } from '@/lib/domain/commands';
import { newReturnToPlay } from '@/lib/domain/rtp';
import type {
  ClassYear,
  Evaluation,
  EvaluationOutcome,
  Impact,
  Player,
  PlayerSessionStats,
  RosterStatus,
  Sensor,
  Session,
  Snapshot,
  Team,
} from '@/lib/domain/types';
import { classifyImpact } from '@/lib/domain/views';

/**
 * Deterministic demo season, dated relative to `now` so the live game is
 * always "tonight". Numbers mirror the product mockups: #54 Jordan Carter
 * takes a 96 g hit at Q3 08:42, 134 impacts this session, 22 of 24 helmets
 * connected, two sensors needing reassignment, and one player (#31) already
 * in the return-to-play protocol from last week's game.
 *
 * The same generator feeds the in-browser demo store and `npm run seed`.
 */

export const DEMO_TEAM_ID = 'demo-varsity';
const SEASON_WEEKS = 12; // weeks 0..11, week 11 is the current week

/* ---------------------------- PRNG ---------------------------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --------------------------- Roster --------------------------------- */

type Exposure = 'line' | 'mid' | 'skill' | 'low' | 'kicker';

interface RosterSeed {
  n: number;
  first: string;
  last: string;
  pos: string;
  cls: ClassYear;
  exposure: Exposure;
  avgPeak: number;
  sensor?: string;
  battery?: number;
  offline?: boolean;
  status?: RosterStatus;
  note?: string;
  archived?: number;
}

const ROSTER: RosterSeed[] = [
  { n: 54, first: 'Jordan', last: 'Carter', pos: 'LB', cls: 'Jr.', exposure: 'mid', avgPeak: 37, sensor: 'HT-0137', battery: 71, archived: 188 },
  { n: 22, first: 'Marcus', last: 'Reyes', pos: 'RB', cls: 'Sr.', exposure: 'mid', avgPeak: 36, sensor: 'HT-0151', battery: 68, archived: 341 },
  { n: 75, first: 'Anders', last: 'Lindqvist', pos: 'OL', cls: 'Sr.', exposure: 'line', avgPeak: 31, sensor: 'HT-0118', battery: 59, archived: 502 },
  { n: 7, first: 'Darius', last: 'Okafor', pos: 'QB', cls: 'Jr.', exposure: 'low', avgPeak: 25, sensor: 'HT-0129', battery: 88, archived: 74 },
  { n: 88, first: 'Tyson', last: 'Brooks', pos: 'WR', cls: 'So.', exposure: 'low', avgPeak: 27, sensor: 'HT-0110', battery: 77 },
  { n: 61, first: 'Rohan', last: 'Patel', pos: 'OL', cls: 'Jr.', exposure: 'line', avgPeak: 32, sensor: 'HT-0104', battery: 74, archived: 296 },
  { n: 33, first: 'Kendrick', last: 'Wallace', pos: 'S', cls: 'Sr.', exposure: 'mid', avgPeak: 34, sensor: 'HT-0145', battery: 80, archived: 277 },
  { n: 91, first: 'Eli', last: 'Morales', pos: 'DL', cls: 'Sr.', exposure: 'line', avgPeak: 34, sensor: 'HT-0122', battery: 66, archived: 455 },
  { n: 24, first: 'Caleb', last: 'Nguyen', pos: 'CB', cls: 'So.', exposure: 'skill', avgPeak: 29, sensor: 'HT-0133', battery: 91 },
  { n: 44, first: 'Brady', last: 'Hayes', pos: 'FB', cls: 'Jr.', exposure: 'mid', avgPeak: 37, sensor: 'HT-0108', battery: 62, archived: 160 },
  { n: 5, first: 'Luke', last: 'Grant', pos: 'WR', cls: 'Fr.', exposure: 'low', avgPeak: 24, sensor: 'HT-0149', battery: 94 },
  { n: 12, first: 'Sam', last: 'Kim', pos: 'TE', cls: 'Jr.', exposure: 'mid', avgPeak: 33, sensor: 'HT-0126', battery: 6, offline: true, archived: 121 },
  { n: 3, first: 'Isaiah', last: 'Freeman', pos: 'CB', cls: 'Sr.', exposure: 'skill', avgPeak: 29, sensor: 'HT-0112', battery: 85, archived: 198 },
  { n: 9, first: 'Wyatt', last: 'Collins', pos: 'QB', cls: 'So.', exposure: 'low', avgPeak: 23, sensor: 'HT-0139', battery: 90 },
  { n: 17, first: 'Mason', last: 'Ortiz', pos: 'WR', cls: 'Jr.', exposure: 'low', avgPeak: 26, sensor: 'HT-0115', battery: 83, archived: 66 },
  { n: 21, first: 'Jamal', last: 'Pierce', pos: 'RB', cls: 'So.', exposure: 'mid', avgPeak: 35, sensor: 'HT-0131', battery: 79 },
  { n: 28, first: 'Cole', last: 'Henderson', pos: 'S', cls: 'Jr.', exposure: 'mid', avgPeak: 33, sensor: 'HT-0147', battery: 72, archived: 143 },
  { n: 31, first: 'Xavier', last: 'Bell', pos: 'LB', cls: 'Sr.', exposure: 'mid', avgPeak: 38, sensor: 'HT-0106', battery: 69, archived: 389 },
  { n: 50, first: 'Nate', last: 'Sullivan', pos: 'OL', cls: 'Sr.', exposure: 'line', avgPeak: 31, sensor: 'HT-0101', battery: 58, archived: 478 },
  { n: 56, first: 'Devin', last: 'Foster', pos: 'LB', cls: 'So.', exposure: 'mid', avgPeak: 35, sensor: 'HT-0154', battery: 81 },
  { n: 66, first: 'Ty', last: 'Robinson', pos: 'OL', cls: 'Jr.', exposure: 'line', avgPeak: 30, sensor: 'HT-0119', battery: 76, archived: 233 },
  { n: 72, first: 'Gavin', last: 'Shaw', pos: 'OL', cls: 'So.', exposure: 'line', avgPeak: 30, sensor: 'HT-0124', battery: 41, offline: true },
  { n: 95, first: 'Andre', last: 'Lewis', pos: 'DL', cls: 'Jr.', exposure: 'line', avgPeak: 33, sensor: 'HT-0141', battery: 70, archived: 210 },
  { n: 10, first: 'Ben', last: 'Archer', pos: 'K', cls: 'Sr.', exposure: 'kicker', avgPeak: 19, sensor: 'HT-0160', battery: 96, archived: 31 },
  // Left the active roster — their sensors need a new home.
  { n: 80, first: 'Patrick', last: 'Doyle', pos: 'WR', cls: 'Sr.', exposure: 'low', avgPeak: 26, sensor: 'HT-0142', battery: 82, status: 'graduated', note: 'Graduated', archived: 412 },
  { n: 14, first: 'Grant', last: 'Fisher', pos: 'K', cls: 'Jr.', exposure: 'kicker', avgPeak: 19, sensor: 'HT-0171', battery: 64, status: 'inactive', note: 'No longer playing', archived: 22 },
  // Active, waiting for a sensor.
  { n: 36, first: 'Jalen', last: 'Whitfield', pos: 'LB', cls: 'So.', exposure: 'mid', avgPeak: 35, note: 'New helmet issued' },
  { n: 19, first: 'Nico', last: 'Alvarez', pos: 'WR', cls: 'Fr.', exposure: 'low', avgPeak: 25 },
  { n: 67, first: 'Owen', last: 'Mensah', pos: 'OL', cls: 'Fr.', exposure: 'line', avgPeak: 30 },
  { n: 2, first: 'Trey', last: 'Ross', pos: 'CB', cls: 'Jr.', exposure: 'skill', avgPeak: 29, note: 'Transfer' },
];

const SPARES: Array<{ id: string; battery: number }> = [
  { id: 'HT-0163', battery: 100 },
  { id: 'HT-0158', battery: 97 },
];

export const playerId = (s: { n: number; last: string }) => `pl_${s.last.toLowerCase()}_${s.n}`;

/** Average hits per session by exposure group. */
const RATES: Record<Exposure, { practice: number; game: number }> = {
  line: { practice: 6.5, game: 17 },
  mid: { practice: 5.5, game: 11 },
  skill: { practice: 3, game: 6 },
  low: { practice: 1.8, game: 3.5 },
  kicker: { practice: 0.3, game: 1 },
};

/* --------------------------- Schedule ------------------------------- */

const PRACTICE_LABELS = [
  'Practice · individual periods', // Mon
  'Practice · tackling drill', // Tue
  'Practice · team period', // Wed
  'Practice · walkthrough', // Thu
  'Practice · Oklahoma drill', // Fri (preseason)
];
const CONTACT = [0.8, 1.0, 0.75, 0.15, 1.1];
const OPPONENTS = ['Lakeside', 'Fairview', 'North Ridge', 'Cedar Hill', 'Mason Creek', 'Eastgate', 'Hillcrest', 'Brookfield', 'Pine Valley'];
export const LIVE_OPPONENT = 'Ridgeview';

function atDay(weekMonday: number, dayOffset: number, hour: number, minute = 0): number {
  const d = new Date(weekMonday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/* ------------------------ Scripted alerts --------------------------- */

interface ScriptedAlert {
  n: number;
  week: number;
  day: number; // 0 = Mon … 4 = Fri
  g: number;
  outcome: EvaluationOutcome;
  note: string;
  label?: string;
}

const HISTORY_ALERTS: ScriptedAlert[] = [
  { n: 54, week: 2, day: 1, g: 84, outcome: 'cleared', note: 'Sideline assessment normal', label: 'Practice · Oklahoma drill' },
  { n: 22, week: 3, day: 0, g: 81, outcome: 'excluded', note: 'Helmet knocked off bench, not worn' },
  { n: 54, week: 4, day: 3, g: 91, outcome: 'excluded', note: 'Helmet not worn (dropped), not counted' },
  { n: 54, week: 5, day: 1, g: 88, outcome: 'cleared', note: 'Sideline assessment normal, returned next day' },
  { n: 31, week: 6, day: 4, g: 83, outcome: 'cleared', note: 'Sideline assessment normal' },
  { n: 75, week: 7, day: 1, g: 82, outcome: 'cleared', note: 'Sideline assessment normal' },
  { n: 91, week: 8, day: 4, g: 86, outcome: 'cleared', note: 'Sideline assessment normal' },
  { n: 31, week: 10, day: 4, g: 102, outcome: 'protocol', note: 'Removed from play, physician notified' },
];

/* ------------------------- Live session ----------------------------- */

interface LivePlan {
  hits: number;
  last: number;
  /** Max g for the non-final hits. */
  cap?: number;
  /** Final hit is scripted at this Q3 clock / seconds-ago. */
  scripted?: { clock: string; agoSec: number; rot?: number };
  perPeriod?: [number, number, number];
}

const LIVE: Record<number, LivePlan> = {
  54: { hits: 14, last: 96, cap: 58, scripted: { clock: '08:42', agoSec: 42, rot: 5400 }, perPeriod: [4, 6, 3] },
  22: { hits: 9, last: 71, cap: 55, scripted: { clock: '09:15', agoSec: 100 } },
  75: { hits: 22, last: 64, cap: 58, scripted: { clock: '09:40', agoSec: 140 } },
  91: { hits: 17, last: 52, cap: 56, scripted: { clock: '09:58', agoSec: 170 } },
  33: { hits: 8, last: 55, cap: 56, scripted: { clock: '10:12', agoSec: 200 } },
  61: { hits: 19, last: 48, cap: 57, scripted: { clock: '10:51', agoSec: 240 } },
  7: { hits: 3, last: 32 },
  88: { hits: 5, last: 41 },
  24: { hits: 4, last: 29 },
  44: { hits: 11, last: 44 },
  5: { hits: 2, last: 18 },
  3: { hits: 2, last: 26 },
  17: { hits: 1, last: 22 },
  21: { hits: 3, last: 38 },
  28: { hits: 3, last: 35 },
  50: { hits: 4, last: 33 },
  56: { hits: 3, last: 40 },
  66: { hits: 2, last: 30 },
  95: { hits: 1, last: 37 },
  10: { hits: 1, last: 15 },
};

/* --------------------------- Generator ------------------------------ */

export function generateDemoSnapshot(now: number = Date.now(), seed = 54): Snapshot {
  const rand = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const hitCount = (mean: number) => {
    if (mean <= 0) return 0;
    const v = mean * between(0.65, 1.35);
    return v < 1 ? (rand() < v ? 1 : 0) : Math.round(v);
  };

  const team: Team = {
    id: DEMO_TEAM_ID,
    name: 'Varsity',
    school: 'Westbrook High School',
    season: new Date(now).getFullYear(),
    alertThresholdG: 80,
    watchThresholdG: 60,
    physicianName: 'Dr. Elena Ruiz',
    liveSessionId: null,
  };

  const thisMonday = weekStart(now);
  const mondayOf = (week: number) => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - (SEASON_WEEKS - 1 - week) * 7);
    return d.getTime();
  };
  const todayIdx = (new Date(now).getDay() + 6) % 7; // 0 = Mon

  /* Players & sensors */
  const players: Player[] = [];
  const sensors: Sensor[] = [];
  const seasonStart = mondayOf(0);
  for (const r of ROSTER) {
    const id = playerId(r);
    players.push({
      id,
      number: r.n,
      firstName: r.first,
      lastName: r.last,
      position: r.pos,
      classYear: r.cls,
      rosterStatus: r.status ?? 'active',
      note: r.note ?? null,
      sensorId: r.sensor ?? null,
      archivedImpactCount: r.archived ?? 0,
      rtp: null,
    });
    if (r.sensor) {
      const issued = seasonStart - 21 * DAY_MS;
      sensors.push(
        newSensor(r.sensor, issued, {
          playerId: id,
          battery: r.battery ?? 80,
          connection: r.offline ? 'offline' : 'online',
          lastSeenAt: r.offline ? now - (r.battery !== undefined && r.battery < 10 ? 26 : 3) * 3_600_000 : now - 5_000,
          history: [{ playerId: id, from: issued, to: null, reason: null }],
        }),
      );
    }
  }
  for (const s of SPARES) {
    sensors.push(newSensor(s.id, seasonStart - 21 * DAY_MS, { battery: s.battery }));
  }
  const byNumber = new Map(ROSTER.map((r) => [r.n, r]));

  /* Season sessions (everything before today's game) */
  const sessions: Session[] = [];
  const impacts: Impact[] = [];
  let opponentIdx = 0;

  const addSession = (week: number, day: number, type: 'practice' | 'game'): Session => {
    const monday = mondayOf(week);
    const startedAt = type === 'game' ? atDay(monday, day, 19, 0) : atDay(monday, day, 15, 30);
    const endedAt = startedAt + (type === 'game' ? 150 : day === 3 ? 60 : 120) * 60_000;
    const opponent = type === 'game' ? OPPONENTS[opponentIdx++ % OPPONENTS.length] : null;
    const session: Session = {
      id: `ses_w${String(week).padStart(2, '0')}_${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][day]}`,
      type,
      label: type === 'game' ? `${team.name} vs. ${opponent}` : PRACTICE_LABELS[day],
      opponent,
      startedAt,
      endedAt,
      clock: type === 'game' ? { period: 4, remainingSec: 0, runningSince: null } : null,
      playerStats: {},
    };
    // Who played: active players with sensors, plus #14 early in the season.
    const taper = Math.max(0.3, 1.3 - 0.1 * week);
    for (const r of ROSTER) {
      if (!r.sensor || r.status === 'graduated') continue;
      if (r.n === 14 && week > 3) continue;
      if (r.n === 31 && week === SEASON_WEEKS - 1) continue; // in protocol this week
      const rate = RATES[r.exposure][type] * (type === 'practice' ? CONTACT[day] * taper : 1);
      const hits = hitCount(rate);
      if (hits === 0) continue;
      const avg = r.avgPeak * between(0.9, 1.1);
      session.playerStats[playerId(r)] = { hits, sumPeakG: Math.round(hits * avg * 10) / 10 };
    }
    sessions.push(session);
    return session;
  };

  for (let week = 0; week < SEASON_WEEKS; week++) {
    const preseason = week < 2;
    const current = week === SEASON_WEEKS - 1;
    for (let day = 0; day < 5; day++) {
      if (current && (day >= todayIdx || day === 4)) break; // tonight's live game replaces Friday's
      if (!preseason && day === 4) {
        addSession(week, day, 'game');
      } else {
        addSession(week, day, 'practice');
      }
    }
  }

  /* Scripted historical alerts */
  const evaluation = (outcome: EvaluationOutcome, note: string, at: number): Evaluation => ({
    status: 'resolved',
    acknowledgedAt: at + 30_000,
    checklist: { removed: outcome !== 'excluded', assessed: outcome !== 'excluded', physicianNotified: outcome === 'protocol' },
    outcome,
    note,
    resolvedAt: at + (outcome === 'protocol' ? 25 : 12) * 60_000,
  });

  HISTORY_ALERTS.forEach((a, idx) => {
    const r = byNumber.get(a.n)!;
    const sid = `ses_w${String(a.week).padStart(2, '0')}_${['mon', 'tue', 'wed', 'thu', 'fri'][a.day]}`;
    const session = sessions.find((s) => s.id === sid);
    if (!session) return;
    if (a.label) session.label = a.label;
    const pid = playerId(r);
    const stats: PlayerSessionStats = session.playerStats[pid] ?? { hits: 0, sumPeakG: 0 };
    stats.hits += 1;
    stats.sumPeakG = Math.round((stats.sumPeakG + a.g) * 10) / 10;
    session.playerStats[pid] = stats;
    const at = session.startedAt + between(0.3, 0.8) * ((session.endedAt ?? session.startedAt) - session.startedAt);
    const period = session.clock ? 1 + Math.floor(between(0, 4)) : null;
    impacts.push({
      id: `imp_hist_${idx}`,
      sessionId: session.id,
      playerId: pid,
      sensorId: r.sensor!,
      at: Math.round(at),
      linearG: a.g,
      rotationalRadS2: Math.round((a.g * between(50, 60)) / 10) * 10,
      period,
      clockLabel: session.clock ? formatClock(between(30, PERIOD_SEC - 30)) : formatClock((at - session.startedAt) / 1000),
      level: 'alert',
      evaluation: evaluation(a.outcome, a.note, at),
    });

    if (a.outcome === 'protocol') {
      // Started the next morning; steps 1 and 2 complete, step 3 in progress.
      const start = Math.min(at + 14 * 3_600_000, now - 2 * DAY_MS);
      const rtp = newReturnToPlay(start, `imp_hist_${idx}`);
      const s1 = start + DAY_MS;
      const s2 = Math.max(s1 + 3_600_000, Math.min(start + 3 * DAY_MS, now - 2 * 3_600_000));
      rtp.steps['1'] = { startedAt: start, completedAt: s1 };
      rtp.steps['2'] = { startedAt: s1, completedAt: s2 };
      rtp.steps['3'] = { startedAt: s2, completedAt: null };
      rtp.currentStep = 3;
      const player = players.find((p) => p.id === pid)!;
      player.rtp = rtp;
    }
  });

  /* Hit #54's season target so history reads 294 impacts with the live game */
  const carterId = playerId(byNumber.get(54)!);
  const carterLiveHits = LIVE[54].hits;
  let carterTotal = sessions.reduce((sum, s) => sum + (s.playerStats[carterId]?.hits ?? 0), 0);
  const practices = sessions.filter((s) => s.type === 'practice' && s.playerStats[carterId]);
  let guard = 0;
  while (carterTotal !== 294 - carterLiveHits && guard++ < 2000) {
    const s = practices[Math.floor(rand() * practices.length)];
    const stats = s.playerStats[carterId];
    if (carterTotal < 294 - carterLiveHits) {
      stats.hits += 1;
      stats.sumPeakG = Math.round((stats.sumPeakG + 36) * 10) / 10;
      carterTotal += 1;
    } else if (stats.hits > 2) {
      stats.hits -= 1;
      stats.sumPeakG = Math.round((stats.sumPeakG - 36) * 10) / 10;
      carterTotal -= 1;
    }
  }

  /* Tonight's game — live, Q3 07:18 on the clock */
  const kickoff = now - 95 * 60_000;
  const live: Session = {
    id: `ses_live_${new Date(now).toISOString().slice(0, 10).replace(/-/g, '')}`,
    type: 'game',
    label: `${team.name} vs. ${LIVE_OPPONENT}`,
    opponent: LIVE_OPPONENT,
    startedAt: kickoff,
    endedAt: null,
    clock: { period: 3, remainingSec: 438, runningSince: now },
    playerStats: {},
  };
  team.liveSessionId = live.id;

  const windows: Record<number, [number, number]> = {
    1: [now - 95 * 60_000, now - 70 * 60_000],
    2: [now - 65 * 60_000, now - 40 * 60_000],
    3: [now - 22 * 60_000, now - 260_000],
  };
  // Q1/Q2 run the full 12:00 → 00:00; generated Q3 hits fall before 11:00.
  const clockAt = (period: number, frac: number) =>
    formatClock(period === 3 ? PERIOD_SEC - frac * 60 : PERIOD_SEC - frac * (PERIOD_SEC - 20));

  const rotFor = (g: number) => Math.round((g * between(50, 62)) / 10) * 10;
  let liveSeq = 0;

  for (const [numStr, plan] of Object.entries(LIVE)) {
    const r = byNumber.get(Number(numStr))!;
    const pid = playerId(r);
    const generated = plan.hits - (plan.scripted ? 1 : 0);
    const periods: number[] = [];
    if (plan.perPeriod) {
      plan.perPeriod.forEach((count, i) => {
        for (let k = 0; k < count; k++) periods.push(i + 1);
      });
    } else {
      for (let k = 0; k < generated; k++) {
        const x = rand();
        periods.push(x < 0.4 ? 1 : x < 0.8 ? 2 : 3);
      }
    }
    const rows: Impact[] = periods.map((period) => {
      const [lo, hi] = windows[period];
      const frac = rand();
      const cap = plan.cap ?? Math.max(plan.last, 45);
      const g = Math.round(Math.min(cap, Math.max(12, r.avgPeak * between(0.55, 1.45))) * 10) / 10;
      return {
        id: `imp_live_${liveSeq++}`,
        sessionId: live.id,
        playerId: pid,
        sensorId: r.sensor!,
        at: Math.round(lo + frac * (hi - lo)),
        linearG: g,
        rotationalRadS2: rotFor(g),
        period,
        clockLabel: clockAt(period, frac),
        level: 'logged' as const,
        evaluation: null,
      };
    });
    rows.sort((a, b) => a.at - b.at);

    if (plan.scripted) {
      rows.push({
        id: `imp_live_${liveSeq++}`,
        sessionId: live.id,
        playerId: pid,
        sensorId: r.sensor!,
        at: now - plan.scripted.agoSec * 1000,
        linearG: plan.last,
        rotationalRadS2: plan.scripted.rot ?? rotFor(plan.last),
        period: 3,
        clockLabel: plan.scripted.clock,
        level: 'logged',
        evaluation: null,
      });
    } else if (rows.length) {
      rows[rows.length - 1].linearG = plan.last;
      rows[rows.length - 1].rotationalRadS2 = rotFor(plan.last);
    }

    let sum = 0;
    for (const row of rows) {
      row.level = classifyImpact(row.linearG, team);
      row.evaluation =
        row.level === 'alert'
          ? { status: 'open', acknowledgedAt: null, checklist: { removed: false, assessed: false, physicianNotified: false }, outcome: null, note: null, resolvedAt: null }
          : null;
      sum += row.linearG;
      impacts.push(row);
    }
    live.playerStats[pid] = { hits: rows.length, sumPeakG: Math.round(sum * 10) / 10 };

    const sensor = sensors.find((s) => s.id === r.sensor);
    if (sensor && sensor.connection === 'online' && rows.length) {
      sensor.lastSeenAt = Math.max(rows[rows.length - 1].at, now - 4_000);
    }
  }
  sessions.push(live);

  return { team, players, sensors, sessions, impacts };
}
