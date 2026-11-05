# H.I.T.T. — operational rules for Claude Code

Read `Docs/Project.md` first for architecture. This file is the **must-not-break**
list — keep it short, keep it current.

## Branches

- All work lands on `dev` (or a feature branch off `dev`). `dev` → `main` by PR only.
- Never commit to `main` directly. Vercel production deploys from `main`.

## One write path

- Every mutation is a pure command in `src/lib/domain/commands.ts` returning
  `Change[]`. The demo store and Firestore both apply those changes — never write
  to Firestore (or the demo store) any other way, or the two modes drift.
- UI calls `actions.*` / `ingestReading` in `src/lib/actions.ts`; sensor input
  (USB gateway, simulator, `/api/ingest`) all go through `recordImpact`.
- Every impact must also increment `sessions/{id}.playerStats.{playerId}`
  (`hits`, `sumPeakG`). Season history reads those aggregates, not impact docs.

## Data rules

- Timestamps are epoch **milliseconds** (numbers), never Firestore `Timestamp`.
- IDs used as map keys (player IDs) must be `[a-z0-9_]` — they appear in dotted
  update paths.
- `npm run seed` **wipes** `teams/{teamId}` before writing. Confirm with the user
  before running it against a real (non-emulator) project with real data.
- The demo season must keep matching the mockup numbers — `npm test` asserts
  them (134 impacts, 96 g alert, 294 season impacts, etc.).

## Safety copy

- Never say the product diagnoses concussion. Keep the disclaimer on every
  screen: "flags impacts for evaluation by a qualified professional."
- Return-to-play decisions belong to the athletic trainer and a licensed
  healthcare provider; the app records steps. Full contact stays gated on
  medical clearance (`canCompleteCurrentStep`).

## Secrets

- Public repo. Never commit `.env.local`, service-account JSON or
  `HITT_INGEST_KEY`. `FIREBASE_SERVICE_ACCOUNT_KEY` lives only in `.env.local`
  and Vercel env vars.

## Before pushing

`npm run typecheck && npm run lint && npm test && npm run build`
(and `npm run verify:firestore` when touching repositories, commands or rules).
