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
- `cd mobile && npx expo start --ios` (Expo Go on the simulator). Online race
  talks to `server.js`; set `EXPO_PUBLIC_SOCKET_URL` (default `http://localhost:3000`).
- `npx tsc --noEmit` and `npx expo lint` in `mobile/` must stay at 0; CI runs both.
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
