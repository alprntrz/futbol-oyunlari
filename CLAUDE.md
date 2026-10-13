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

## Mobile app (`mobile/`), released as Tiktako

Native iOS/Android app in Expo (SDK 57, Expo Router, React Native) — real native
UI, not a WebView. It reuses the web project's game logic and data directly:
`@/…` in `mobile/` resolves to `../src/…` (tsconfig paths + `watchFolders` in
`mobile/metro.config.js`); the app's own code is imported as `~/…`.

- Shared, keep platform-free: `src/lib/{types,wordle,formations,daily,tiki,strings}.ts`
  and `src/data/*`. No DOM/`localStorage`/React in these.
- UI strings live in `src/lib/strings.ts` (used by both apps).
- `cd mobile && npx expo start --ios` (Expo Go on the simulator). Online play
  talks to `server.js`; set `EXPO_PUBLIC_SOCKET_URL` (default `http://localhost:3000`).
- Hat-trick is shown to players as "Tic-Tac-Toe" (v1.1 rename; code, routes and `ht:*` keep the old name).
- Online mode in the app is Hat-trick only (`ht:*` socket events in `server.js`, incl. `ht:queue` matchmaking:
  server owns turn, 45 s clock and result; the host's phone deals the grid as
  criterion ids; a queue match gets `HT_INTRO_MS` before X's clock for the VS screen,
  after 20 s an empty queue falls back to a local house bot, `mobile/src/lib/htBot.ts`, that
  mirrors the online room: random nickname, human-like timing; `ht:draw-offer` / `ht:draw-reply` /
  `ht:forfeit` end games early; a match is a series, first to `HT_TARGET` = 3 game wins,
  wins kept per player id; the host's phone deals the next game via `ht:rematch`; `ht:skip` passes). Mystery Player (`mobile/src/app/gizli.tsx`, `lib/mystery.ts`) is offline.
- Leagues (`src/lib/leagues.ts`): Hat-trick grids per league (`leagueGrid`, only that league's
  clubs plus countries/honours; leagues need 3+ clubs in tiki CLUBS); the pick lives in
  `mobile/src/lib/league.ts` and rooms/queue carry `league`. Missing 11 categories (`XI_CATEGORIES`)
  filter matches by tag/competition.
- Football Quiz (`qz:*`, screens in `mobile/src/app/bilgi/`): questions are generated from the shared
  data by `src/lib/quiz.ts` on the creator's phone and sent with answers; the server hides answers
  until the reveal, runs the clock and scores (`qzPoints` in server.js mirrors `quizPoints`: 10 → 5
  by speed). Random rooms (`qz:queue`) start after 15 s and fill up with house players.
  Levels/standings: phones send a random install id (`pid`, `loadPlayerId` in `mobile/src/lib/nick.ts`);
  at full time the server adds XP (points + 10 + podium bonus) to `data/quiz-stats.json` (gitignored;
  `QZ_STATS_FILE` overrides) and emits `qz:progress`; `qz:profile` / `qz:standings` read it. House
  players never get a record.
  Difficulty (`QuizDifficulty` easy/normal/hard in quiz.ts): fame-ranked player pools (honours + classic-match
  starts) and match pools (finals → big games → all); hard adds exact scores. Random rooms match per level
  (`qzOpen[level]`); the pick is `useQuizDifficulty` (mobile/src/lib/quizLevel.ts). Home's `QuickPlay` card
  starts a random game (Hat-trick / Quiz / Possession, last choice remembered). On a real deployment that file needs a persistent disk (or a database).
- Release: `docs/release/` (checklist, App Store metadata). Public pages (privacy, support) live
  in `site/` and deploy with `.github/workflows/pages.yml`. Privacy promises made there: no
  analytics/ads/tracking SDKs, no IP logging, quiz record = random id + nick + counts only, and
  Settings > Delete my data (`qz:forget` + local wipe). Keep them true when adding anything.
- Accounts (v1.1, optional): Sign in with Apple / Google; `server-accounts.js` (node:sqlite, `ACCOUNTS_DB`,
  `/api/account/*`) verifies the provider token and stores only provider + opaque sub, nick, avatar,
  XP — never name or e-mail (no scopes requested). App side `mobile/src/lib/account.ts` (session in
  SecureStore, awards queued to `/xp`, daily +20 bonus, `DELETE /api/account` + Apple revoke).
  Env/secrets: `APPLE_AUDIENCES`, `GOOGLE_CLIENT_IDS`, `APPLE_TEAM_ID/KEY_ID/PRIVATE_KEY`;
  app: `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` + the reversed id as `iosUrlScheme` in app.json.
- Game feel (v1.1, from a Duolingo study): `components/Combo.tsx` (`useCombo`, `ComboChip`, `ComboBurst` at
  3/5/8/…; Missing 11 + Quiz), `components/RewardScreen.tsx` (awards with `stats` open a "Claim XP" screen
  instead of the toast; mounted in the root layout), daily quests `lib/quests.ts` (3/day from different
  games, `questEvent` / `useQuestOnce`), 7-day reward calendar `lib/dailyRewards.ts` (fixed amounts, no
  random chests). Both pay XP as source "bonus". Home shows `HomeStatus` (level, play streak `lib/playStreak.ts`, gift that claims the day), `TodayPuzzles`
  (grid / Daily XI / Bingo read from their screens' save keys; the grid's big card folds into a row once done) + `QuestsCard`;
  the 7-day `DailyRewardCard` lives on Profile.
- Ranks (v1.1): `RANKS` / `rankOf` in `src/lib/levels.ts` name the level bands (Amateur → Legend, bronze/silver/gold
  steps; `components/Rank.tsx`). The rank index is the matchmaking tier: `ht:queue`, `pp:queue`, `qz:queue` carry `tier`
  (`loadTier` in lib/xp.ts); server.js `takePairs` / `tierGap` pair the same rank first and widen every `TIER_WIDEN_MS`
  (a 1 s sweep, `matchQueues`). Quiz random rooms are keyed `difficulty:tier` in `qzOpen`.
- Friends (v1.1, signed-in): `friends` table + `users.friend_code` in server-accounts.js (`/api/account/friends`
  GET/POST {code}/DELETE /:code; added both ways, max 100). Presence = any socket with that `uid`; `fr:invite`
  {to: friend code, game: "ht", room} → `fr:invited` on the friend's sockets (3 s rate limit). App: `app/arkadaslar.tsx`,
  `components/InviteBanner.tsx` (root layout; keeps a socket open while signed in). Friends see nick, avatar, level, online only.
- Caps: the app sends `caps` in the socket handshake (lib/socket.ts `CAPS`); "mate" / "coach" = can draw "played with" /
  "managed by" criteria (`MATE_CRITERIA`, `COACH_CRITERIA`, `withLink` in tiki.ts; data `src/data/teammates.ts`,
  `src/data/coaches.ts` ← `scripts/tiki-scrape-seasons.mjs` + `scripts/tiki-scrape-coaches.mjs` →
  `scripts/tiki-build-teammates.mjs` / `tiki-build-coaches.mjs`). server.js keeps such grids away from phones that
  can't draw them (`canDraw`, `htAllKnowMates`). Daily grids never get them (seeded, unchanged).
- Ratings (v1.1): Elo per online game (`ht` series, `qz` by placement, `pp`), signed-in humans only.
  The app sends its session token in the socket handshake (`setSessionToken` in lib/socket.ts);
  server.js stores `uid` on each player and calls `recordResult` (server-accounts.js). Leaving a live
  Hat-trick series / Possession game counts as a loss. Boards: `GET /api/account/leaderboard?board=xp|ht|qz|pp`,
  screen `mobile/src/app/siralamalar.tsx`.
- XP and levels (v1.1): every game pays XP through `awardXp` / `useXpAward` in `mobile/src/lib/xp.ts`
  (local, AsyncStorage `xp-v1`); amounts in `XP` and the curve in `levelOf`, both in `src/lib/levels.ts`.
  Each award has a unique key so a game never pays twice; unlimited modes pass `practice` (daily cap).
  The "+XP" toast (`XpToast`, root layout) waits while a `Victory` modal is open. The Stats tab is now
  Profile (`app/(tabs)/istatistik.tsx` + `ProfileCard`): nickname, preset 3D avatar (`lib/avatar.ts`, art in `mobile/assets/brand/avatar/`, 256 px, trimmed and bottom-aligned; ids are stored on accounts, keep them stable), level.
- Reward moments: `Victory.tsx` (ceremony) with art from `docs/design/oyun-hissi-brief.md`
  → `python3 scripts/reward-assets.py <dir>` → `mobile/assets/brand/odul/` (`REWARD` in brand.ts).
  Sounds are synthesised by `python3 scripts/game-sounds.py` → `mobile/assets/sounds/`, played via
  `play()` in `mobile/src/lib/sound.ts` (expo-audio; respects the silent switch; toggle in Settings).
- Kombine (football match-3, shelved: no entry in the Games tab, routes kept): rules in `mobile/src/lib/kombine/engine.ts` (pure, no React; the
  board UI only animates the phases `swap()` returns), levels in `levels.ts`. After changing
  rules or levels run `node mobile/scripts/kombine-sim.mts` and keep the win rates on target.
  The match screen opts out of React Compiler memoization because the engine mutates `game`.
  Possession Play uses `pp:*` (same pattern, two chess clocks;
  the mover's phone computes claimed hexes). Football Bingo is offline (daily
  seeded card, `mobile/src/lib/bingo.ts`). The Missing 11 race (`room:*`, `race:*`) is still served for
  the web app but has no screen in the mobile app.
- `npx tsc --noEmit` and `npx expo lint` in `mobile/` must stay at 0; CI runs both.
- After any dependency change in `mobile/` (incl. `npx expo install`), run
  `npx npm@latest install --package-lock-only` there: older npm drops the `@emnapi/*`
  peers from the lock and then `npm ci` fails on CI and on EAS Build.
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
