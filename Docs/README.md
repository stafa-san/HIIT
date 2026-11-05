# Docs

| File | What it is |
|---|---|
| [Project.md](Project.md) | Architecture, data model, impact lifecycle, known gaps |
| [Pitch deck](<Innovation Challenge - Pitch Deck - Spring 2026 (2).pdf>) | UC Innovation Challenge pitch, Spring 2026 (problem, solution, competition, costs, business model, market, ask, team) |
| [Sideline tablet — trainer dashboard](<Sideline tablet — trainer dashboard.pdf>) | Concept screen |
| [Phone — impact alert](<Phone — impact alert.pdf>) | Concept screen |
| [Tablet — player history & return-to-play](<Tablet — player history & return-to-play.pdf>) | Concept screen |
| [Tablet — sensor reassignment](<Tablet — sensor reassignment.pdf>) | Concept screen |

## Concept screens → app

Each concept screen is implemented as a route. The demo season
(`src/lib/demo/seed.ts`) reproduces the numbers shown in the concepts, and
`npm test` asserts them.

| Concept | Route | Implementation | What matches the concept |
|---|---|---|---|
| Sideline tablet — trainer dashboard | `/` | `src/components/dashboard/` | #54 Carter 96 g / 5,400 rad/s² banner, "3rd alert-level hit this season", 134 impacts, 1 alert, 2 watch, 2 offline, 22 of 24 helmets, roster cards, impacts by quarter 4·6·4·0, evaluation checklist, live feed |
| Phone — impact alert | `/m` | `src/components/mobile/coach-view.tsx` | Full-screen alert, 96 g, 16 g over threshold, 14 hits this session, pull for evaluation / open dashboard / mark as false alarm |
| Player history & return-to-play | `/players/[id]` | `src/components/players/` | Season impacts 294, 3 alert-level hits, weekly practice/game chart with alert markers, alert log (in protocol / cleared / excluded), 6-step return-to-play, medical clearance gate, share + PDF export |
| Sensor reassignment | `/sensors` | `src/components/sensors/sensor-management.tsx` | HT-0142 in graduated #80 Doyle's helmet, 412 impacts stay on the player record, players without a sensor, install-and-verify with test tap, retire instead |

## Beyond the concepts

Built to make the concept screens work end to end:

- **Players roster** (`/players`): status and season stats for every player.
- **Sensor gateway** (header cable icon): USB input from the Arduino through
  Web Serial, plus a hit simulator for demos. See [`../hardware/README.md`](../hardware/README.md).
- **Session controls**: start a game or practice, run the game clock, change quarters.
- **Alert thresholds**: alert and watch levels are editable from the header.
- **`POST /api/ingest`**: lets Wi-Fi sensors send impacts straight to the server.

## Deviations from the concepts

- **Placeholders replaced.** `[OPPONENT]` and `[TEAM PHYSICIAN]` are now
  fictional names (Ridgeview, Westbrook High School, Dr. Elena Ruiz). Change
  them in `src/lib/demo/seed.ts`.
- **Chart colors.** The weekly chart uses a brighter blue pair (`#24519e` /
  `#5a8fe2`) than the concept's navy / light slate. The concept pair failed
  the contrast and colorblind checks.
- **Return-to-play demo player.** In the demo, #31 Xavier Bell is the player
  already mid-protocol (step 3), so the return-to-play screen has data.
  Carter enters the protocol live during the demo, once you log the outcome.
