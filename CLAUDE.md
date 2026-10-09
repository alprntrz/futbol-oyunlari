# Futbol Oyunları — notes for Claude Code

Two football puzzle games (Eksik 11 / Missing XI and Tiki Taka Toe) in Next.js 16 +
React 19 + TypeScript + Tailwind 4, served by a custom `server.js` (Next + Socket.IO
for the online race). UI copy is Turkish + English. The full guide is `README.md`
(Turkish); read it before changing data or scripts.

## Commands

- `npm run dev` — dev server on :3000 (`node server.js`). Do not leave it running
  for hours: Next dev/HMR grows to several GB and crashes. For anything long-lived
  use `npm run build && npm start`.
- `npx tsc --noEmit` and `npm run lint` must stay at 0 errors (lint has 9 known
  warnings, explained in README → Doğrulama). CI runs both plus `npm run build`.
- No automated tests: verify UI changes in a browser (play a round; reload to check
  saved progress; two tabs for the online race).
- Node 22.18+ (`.nvmrc` = 24): the data scripts import `.ts` files directly.

## Conventions that are easy to break

- `Match.lineup` is ordered by `FORMATIONS[formation]` slots in
  `src/lib/formations.ts`, GK first; a back four is `[GK, RB, RCB, LCB, LB]` —
  right to left, the team's right is the viewer's right.
- `answer` is uppercase ASCII (Turkish letters and accents folded, see
  `normalizeAnswer`); multi-word surnames keep a space (`"DI MARIA"`).
- Generated files — never hand-edit, regenerate instead:
  - `src/data/players.ts` ← `scripts/tiki-build-players.mjs`
  - `src/data/matches-ligler.ts`, `src/data/matches-derbiler.ts` ←
    `scripts/build-league-derbies.mjs` → `data-drafts/league-*.json` →
    `scripts/leagues-to-ts.mjs`
- The daily puzzle is `MATCHES[hash(day) % MATCHES.length]`: adding or removing
  matches reshuffles future days.
- Every new UI string goes into both `tr` and `en` in `src/lib/i18n.tsx`.
- Scrapers hit Transfermarkt; keep the request gap (`TM_GAP_MS`, ≥ 2.2 s) and the
  on-disk cache. Their data is under Transfermarkt's terms — see README.
