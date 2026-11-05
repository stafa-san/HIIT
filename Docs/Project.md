# H.I.T.T. — architecture

Concept screens and the mapping to routes: [Docs/README.md](README.md).

## System

```
 helmet sensor ──USB──▶ gateway laptop (Chrome, Web Serial) ─┐
 (Arduino)                                                  │  recordImpact()
 Wi-Fi sensor ──HTTP──▶ POST /api/ingest (Vercel, admin SDK)─┤──────────────▶ Firestore
                                                            │                 teams/{teamId}/…
 simulator (any browser) ───────────────────────────────────┘                     │ onSnapshot
                                                                                  ▼
                              sideline tablet (/)   coach phones (/m)   history / sensors pages
```

- **Next.js 15 App Router** on Vercel. Every page is a client component that
  renders from one in-memory `Snapshot`.
- **Two data modes** (`src/lib/config.ts`):
  - *demo*: no Firebase env vars. `DemoRepository` keeps a generated season in
    `localStorage` and syncs tabs via `storage` events.
  - *firebase*: `FirestoreRepository` signs in anonymously and listens to six
    queries; writes are atomic batches with latency compensation.
- **One write path**: pure commands (`lib/domain/commands.ts`) take the
  current snapshot and return `Change[]` (`set` / dotted-path `update` /
  `increment`). The demo store applies them in memory; Firestore and
  firebase-admin turn them into batches (`lib/data/write-ops.ts`).

## Data model (Firestore)

```
teams/{teamId}                      Team: name, school, season, alertThresholdG,
                                    watchThresholdG, physicianName, liveSessionId
teams/{teamId}/players/{playerId}   Player: number, name, position, classYear,
                                    rosterStatus, note, sensorId, archivedImpactCount, rtp
teams/{teamId}/sensors/{HT-0137}    Sensor: playerId, status, connection, battery,
                                    firmware, lastSeenAt, testStartedAt, lastTestTap, history[]
teams/{teamId}/sessions/{id}        Session: type, label, opponent, startedAt, endedAt,
                                    clock {period, remainingSec, runningSince},
                                    playerStats {playerId: {hits, sumPeakG}}
teams/{teamId}/impacts/{id}         Impact: sessionId, playerId, sensorId, at, linearG,
                                    rotationalRadS2, period, clockLabel, level, evaluation
```

- **Clients subscribe to**: team, players, sensors, sessions (all small), plus
  impacts where `sessionId == liveSessionId` and impacts where
  `level == 'alert'`. Season charts read `sessions.playerStats` aggregates, so
  no client ever downloads a whole season of impacts.
- Single-field equality queries only, so no composite indexes are needed.
- All timestamps are epoch ms.

## Impact lifecycle

1. `recordImpact` resolves sensor → player. Unknown sensor → registered as a
   spare. Sensor in test mode → `lastTestTap`. Sensor on an inactive player →
   heartbeat only. No live session → a practice session opens.
2. Level from team thresholds: **alert** (≥ 80 g) / **watch** (≥ 60 g) / **logged**.
3. Alerts get an `evaluation`: `open` → `evaluating` (pulled) → `resolved` with
   outcome `cleared` | `protocol` | `excluded`. `acknowledgedAt` hides the banner
   without resolving ("Mark reviewed").
4. Outcome `protocol` starts the 6-step return-to-play (`lib/domain/rtp.ts`).
   Completing step 4 (entering full contact) requires recorded medical clearance.
5. `excluded` alerts (dropped helmet, false alarm) don't count toward
   alert-level totals.

## Roster status (dashboard cards)

`out` (RTP active) → `alert` (open, unacknowledged-or-not, in live session) →
`eval` (pulled) → `watch` (session peak ≥ watch threshold) → `offline` (sensor)
→ `ok`. Sort "priority" uses that order.

## Alerting

`useAlertNotifier` fires once per new alert-level impact while a page is open:
Web Audio chime, `navigator.vibrate`, and a system notification (through
`public/sw.js` so it works on Android and installed iOS web apps). Phones open
`/m`, which can be added to the home screen (manifest start_url `/m`).
Background push (FCM) is not implemented — the page must be open.

## Demo season

`lib/demo/seed.ts` is deterministic and dated relative to now: 12 weeks
(2 preseason weeks of practice, then Mon–Thu practice + Friday games), the live
game tonight at Q3 07:18, scripted alerts matching the mockups, #31 Bell
mid-protocol, and two sensors still in departed players' helmets.
`npm test` asserts the headline numbers.

## Known gaps / next steps

- Staff accounts and per-team access rules (currently anonymous auth).
- Background push notifications (FCM) so phones alert with the app closed.
- Sensor heartbeat → automatic offline detection.
- Calibration workflow for raw sensor values (currently a scale factor in the gateway).
