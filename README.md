# H.I.T.T. — Helmet-Integrated TBI Tracker

Sideline software for H.I.T.T.: helmet sensors flag high-magnitude impacts in
real time so athletic trainers and coaches can pull a player for evaluation,
track every hit across the season, and run the return-to-play protocol.

> H.I.T.T. flags high-magnitude impacts for evaluation by a qualified
> professional. It does not diagnose concussion.

| Screen | Route | Who |
|---|---|---|
| **Sideline dashboard**: live alert banner, roster status, player detail, evaluation checklist, live feed | `/` | Athletic trainer (tablet) |
| **Coach alert**: full-screen alert with pull / false-alarm actions, all-clear view otherwise | `/m` | Coaches (phone, installable to home screen) |
| **Player history & return-to-play**: season load chart, alert log, 6-step RTP, medical clearance, PDF export | `/players/[id]` | Trainer, team physician |
| **Players**: roster with season stats and status | `/players` | Trainer |
| **Sensor management**: fleet list, reassign / assign / retire / register, test-tap verification | `/sensors` | Equipment manager |

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

No setup needed: without Firebase env vars the app runs in **demo mode** on a
generated season (Westbrook Varsity vs. Ridgeview, Q3, #54 Jordan Carter just
took a 96 g hit). Demo data lives in the browser; tabs in the same browser stay
in sync, so open `/` and `/m` side by side.

- **Reset demo data**: avatar menu (AT) → *Reset demo data*. It also
  regenerates automatically after 6 h idle so "0:42 ago" stays fresh.
- **Simulate hits**: cable icon in the header → *Sensor gateway* → Routine /
  Watch / Alert-level hit, or *Auto-play game*.
- **Real sensor**: same dialog → *Connect sensor* (Chrome/Edge). See
  [`hardware/README.md`](hardware/README.md) for the line format.
- **Phone on the same Wi-Fi**: `npm run dev:lan`, then open
  `http://<laptop-ip>:3000/m`. In demo mode each device has its own data —
  cross-device alerts need Firebase (below).

## Demo script (≈ 2 min)

1. **Dashboard**: the red banner is #54 Carter, 96 g, 3rd alert-level hit
   this season. Tap **Pull for evaluation** — the phone (`/m`) flips to
   *Pulled for evaluation*.
2. Tick *Sideline assessment* and *Physician notified*, then **Outcome logged** →
   *Start return-to-play protocol*. Carter's card goes to **OUT · RTP step 1**.
3. **Season history & return-to-play →** — weekly load chart, alert log
   (cleared / excluded / in protocol), the 6-step protocol, medical clearance
   gate before full contact, **Export PDF report**.
4. **Live hit**: Mitchell taps the sensor (or *Sensor gateway → Alert-level
   hit*) — chime, banner, and the coach's phone lights up.
5. **Sensor management**: HT-0142 is still in a graduated senior's helmet →
   reassign to #36 Whitfield, *Run test tap*, save. His history stays with Doyle.

## Going live: Firebase + Vercel

Firebase mode syncs every device (tablet, phones, the gateway laptop) through
Firestore in real time. The app signs each device in anonymously.

1. **Firebase project** → [console.firebase.google.com](https://console.firebase.google.com)
   - *Build → Firestore Database* → create (production mode, `us-central`).
   - *Build → Authentication* → *Get started* → *Sign-in method* → enable **Anonymous**.
   - *Project settings → Your apps → Web* → register an app → copy the config.
   - *Project settings → Service accounts* → **Generate new private key** (JSON).
2. **Local env**: `cp .env.example .env.local` and fill in the `NEXT_PUBLIC_FIREBASE_*`
   values, `FIREBASE_SERVICE_ACCOUNT_KEY` (the JSON on one line), and
   `HITT_INGEST_KEY` (`openssl rand -hex 24`).
3. **Rules + data**:
   ```bash
   firebase login && firebase use --add      # pick the project
   npm run deploy:rules                       # firebase/firestore.rules
   npm run seed                               # loads the demo season (~260 docs)
   ```
   Re-run `npm run seed` right before a demo — timestamps are relative to now.
4. **Vercel** → import `stafa-san/HIIT` (framework: Next.js, root: `/`) →
   add the same env vars → deploy. Production deploys from `main`; `dev` gets
   preview deployments.
5. Add the Vercel domain to *Authentication → Settings → Authorized domains*.

Check a deployment with `GET /api/health` (`mode`, `team`, `ingest`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `dev:lan` | Dev server (LAN-visible for phones) |
| `npm run build` | Production build |
| `npm run typecheck` / `lint` | TypeScript / ESLint |
| `npm test` | Domain tests (seed numbers, commands, RTP, serial parser) |
| `npm run verify:firestore` | End-to-end against the Firestore + Auth emulators (needs Java + Firebase CLI) |
| `npm run emulators` | Run the emulators for local dev (`NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true`) |
| `npm run seed` | Wipe and reload the demo season in Firestore |
| `npm run deploy:rules` | Deploy Firestore rules and indexes |

## Project layout

```
src/
  app/                      routes: / , /m , /players , /players/[id] , /sensors , /api/*
  components/               app shell, dashboard, mobile, players, sensors, ui primitives
  lib/domain/               pure model: types, commands, views, RTP, clock, serial parser (+ tests)
  lib/data/                 repositories: demo (localStorage) and Firestore
  lib/gateway/              Web Serial gateway + simulator
  lib/server/               firebase-admin + ingest (API route, seed)
  lib/demo/seed.ts          deterministic demo season
firebase/                   Firestore rules + indexes
hardware/                   sensor ↔ app contract, reference Arduino sketch
scripts/                    seed + emulator verification
Docs/Project.md             architecture and data model
```

## Branches

`dev` is where all changes land first; `dev` merges to `main` by pull request.
Feature branches branch from and merge back into `dev`.

## Team

Tyler Motter (business) · Mitchell Thielen (sensor hardware) · Mustapha Zakari
Nasomah & Fidelis (software) — University of Cincinnati Innovation Challenge.
