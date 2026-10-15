# Kart Düellosu / Card Duel — design

A 1v1 football "top trumps" with a draft. Taken from the Griddy recording
(2026-10-15) and fitted to what we have: our player pool, rank matchmaking,
house bots, Elo, Live Activity, XP and quests.

## One game (≈ 5 min)

1. **Draft (3:00).** Search players by name and fill 7 slots. Today's theme
   limits who can be picked (e.g. "No forwards", "Only Süper Lig", "Only
   Champions League winners"). A **budget** stops seven superstars: every card
   has a tier from fame (gold 3 · silver 2 · bronze 1), 7 cards for 15 points.
   The same 7 serve every match that day until the player redrafts.
2. **Match (7 rounds).** Each round a stat question opens ("More national-team
   caps?"). Both players pick one of their unused cards within 20 s. The cards
   flip together; the higher number takes the round (equal = draw round). A used
   card is gone, so the skill is keeping the right card for the right question.
   Some rounds are "lower wins" (shorter, younger) and say so in red.
3. **Result.** Rounds won (e.g. 4–2), a round-by-round breakdown (my card vs
   theirs, both numbers), XP, Elo for signed-in players, rematch / new opponent.

## Stats (questions)

Only numbers we can source cleanly:

| id | question | source |
|---|---|---|
| apps | more club appearances (league) | Wikidata P54 + P1350, CC0 |
| goals | more club goals (league) | Wikidata P54 + P1351 |
| caps | more national-team caps | Wikidata (national-team stint) |
| intGoals | more national-team goals | Wikidata |
| height | taller (or shorter) | Wikidata P2048 |
| age | born earlier (or later) | Wikidata P569 |
| clubs | played for more clubs | Wikidata stints (club teams) |
| seasons | more seasons at our big clubs | scripts/.cache/raw-seasons.json |
| honours | more of WC / UCL / Ballon d'Or / Euro | players.ts badges |

Transfermarkt's stats pages are rendered by script now; we don't reverse their
internal API (terms). Wikidata covers the well-known players well; a card only
enters the pool if it has at least apps, goals and height. A question is only
dealt if both hands have the number for it.

Pipeline: `scripts/duel-fetch-wikidata.mjs` (resumable cache, matched through
Transfermarkt ids, P2446) → `scripts/duel-build.mjs` → `src/data/duel.ts`
(compact rows aligned with PLAYERS, generated — never hand-edit).

## Modes

- **Online random** (`dz:queue`): rank-tier matchmaking like `ht:queue`; after
  20 s with nobody, the house bot (random nickname, human-like timing, never
  labelled a bot). The server owns the questions, the 20 s clock, hidden picks
  and the reveal; each phone sends its hand (player indexes) at the start and
  the server checks the budget and theme.
- **Friend room** (code + invite banner, like Tic-Tac-Toe).
- **Daily challenge**: today's theme, a seeded house hand and seeded questions,
  same for everyone; one try per day, counts towards the play streak.
- Practice vs bot: unlimited, XP under the practice cap.

## Rules in numbers

- Draft 3:00, 7 cards, budget 15 (gold 3 / silver 2 / bronze 1).
- Tiers: top 150 of the duel pool by fame = gold, next 600 = silver, rest bronze.
- 7 rounds, 20 s a pick; no pick = a random unused card is played.
- Questions: 7 different stats per match; at most 2 "lower wins".
- XP: win 30, draw 15, loss 10 (practice: under the cap); daily challenge +20.
- Elo board `dz` for signed-in humans (bots never rated).

## Screens (mobile)

- `app/duello/index.tsx` — intro, today's theme, my hand (or "Draft"), play buttons.
- `app/duello/draft.tsx` — 7 slots, budget bar, search sheet (name / club),
  theme check on add, timer.
- `app/duello/mac.tsx` — scoreboard, question card, 7-dot round track, my hand
  (used cards dimmed), reveal animation (both cards flip, winner glows).
- Result card with the round breakdown; Live Activity "Round 3/7 · 1–1".
- Card art: country-flag background, kit shirt (club colours of the main club),
  surname, tier frame. Numbers only show on reveal.

## Later (not in v1)

Quick emotes in match (fixed set), match history on Profile, cosmetic card
frames unlocked by rank (no coins, no store).
