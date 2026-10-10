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

## Mobile app (`mobile/`)

Native iOS/Android app in Expo (SDK 57, Expo Router, React Native) — real native
UI, not a WebView. It reuses the web project's game logic and data directly:
`@/…` in `mobile/` resolves to `../src/…` (tsconfig paths + `watchFolders` in
`mobile/metro.config.js`); the app's own code is imported as `~/…`.

- Shared, keep platform-free: `src/lib/{types,wordle,formations,daily,tiki,strings}.ts`
  and `src/data/*`. No DOM/`localStorage`/React in these.
- UI strings live in `src/lib/strings.ts` (used by both apps).
- `cd mobile && npx expo start --ios` (Expo Go on the simulator). Online play
  talks to `server.js`; set `EXPO_PUBLIC_SOCKET_URL` (default `http://localhost:3000`).
- Online mode in the app is Hat-trick only (`ht:*` socket events in `server.js`, incl. `ht:queue` matchmaking:
  server owns turn, 45 s clock and result; the host's phone deals the grid as
  criterion ids; a queue match gets `HT_INTRO_MS` before X's clock for the VS screen,
  after 20 s an empty queue falls back to a local house bot, `mobile/src/lib/htBot.ts`, that
  mirrors the online room: random nickname, human-like timing; `ht:draw-offer` / `ht:draw-reply` /
  `ht:forfeit` end games early). Mystery Player (`mobile/src/app/gizli.tsx`, `lib/mystery.ts`) is offline.
- Football Quiz (`qz:*`, screens in `mobile/src/app/bilgi/`): questions are generated from the shared
  data by `src/lib/quiz.ts` on the creator's phone and sent with answers; the server hides answers
  until the reveal, runs the clock and scores (`qzPoints` in server.js mirrors `quizPoints`: 10 → 5
  by speed). Random rooms (`qz:queue`) start after 15 s and fill up with house players.
  Levels/standings: phones send a random install id (`pid`, `loadPlayerId` in `mobile/src/lib/nick.ts`);
  at full time the server adds XP (points + 10 + podium bonus) to `data/quiz-stats.json` (gitignored;
  `QZ_STATS_FILE` overrides) and emits `qz:progress`; `qz:profile` / `qz:standings` read it. House
  players never get a record. On a real deployment that file needs a persistent disk (or a database).
- Kombine (football match-3, shelved: no entry in the Games tab, routes kept): rules in `mobile/src/lib/kombine/engine.ts` (pure, no React; the
  board UI only animates the phases `swap()` returns), levels in `levels.ts`. After changing
  rules or levels run `node mobile/scripts/kombine-sim.mts` and keep the win rates on target.
  The match screen opts out of React Compiler memoization because the engine mutates `game`.
  Possession Play uses `pp:*` (same pattern, two chess clocks;
  the mover's phone computes claimed hexes). Football Bingo is offline (daily
  seeded card, `mobile/src/lib/bingo.ts`). The Missing 11 race (`room:*`, `race:*`) is still served for
  the web app but has no screen in the mobile app.
- `npx tsc --noEmit` and `npx expo lint` in `mobile/` must stay at 0; CI runs both.
- Look: tab screens are light; every pushed game screen is a "night match" — `Page` (ui.tsx)
  defaults to `night` when not `topInset`: stadium band, faint grass, transparent white header.
  On night screens `Text` swaps dark ink for light (`lib/surface.tsx`); white surfaces (Card, Tap,
  Segmented, sheets, board cells) are wrapped in `<Light>` so their text stays dark. A new white
  `View` holding text on a game screen needs `<Light>` too.
- Read `mobile/AGENTS.md`: Expo APIs change per SDK, check the versioned docs.
- Brand images (`mobile/assets/brand/`) are generated: originals from the
  ChatGPT brief (`docs/design/ikon-brief.md`) → `python3 scripts/brand-assets.py <dir>`.
  Shirts are three layers per collar style (body / sleeves tinted with kit
  colours, grey shade multiplied on top); the number is text. The full-size
  originals are not committed.

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
- Every new UI string goes into both `tr` and `en` in `src/lib/strings.ts`.
- Scrapers hit Transfermarkt; keep the request gap (`TM_GAP_MS`, ≥ 2.2 s) and the
  on-disk cache. Their data is under Transfermarkt's terms — see README.
