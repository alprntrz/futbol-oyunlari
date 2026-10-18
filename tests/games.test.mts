/** Rules of the pure game modules (src/lib): answers, grids, quiz, card duel. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { BUDGET, CARDS, checkHand, dailyRand, dealQuestions, draftable, HAND_SIZE, handCost, houseHand, roundWinner, THEMES } from "@/lib/duel";
import { leagueGrid } from "@/lib/leagues";
import { quizPoints, quizQuestions } from "@/lib/quiz";
import { cellSolvable, generateGrid, seededRandom, withHonour } from "@/lib/tiki";
import { evaluateGuess, normalizeAnswer } from "@/lib/wordle";

test("answers fold Turkish letters and accents, letters only", () => {
  assert.equal(normalizeAnswer("Şükür"), "SUKUR");
  // spaces go too: guesses compare letters only ("DI MARIA" in the data is "DIMARIA" here)
  assert.equal(normalizeAnswer("Di María"), "DIMARIA");
  assert.equal(normalizeAnswer("  çağlar söyüncü "), "CAGLARSOYUNCU");
});

test("a guess is marked like Wordle", () => {
  const marks = evaluateGuess("MESSI", "MESSI");
  assert.ok(marks.every((m) => m === "correct"));
  assert.equal(evaluateGuess("ISSEM", "MESSI").filter((m) => m === "correct").length, 1);
});

test("dealt grids (all clubs, leagues, honours) never have an unsolvable square", () => {
  for (let i = 0; i < 150; i++) {
    const r = seededRandom(i + 11);
    const lg = ["all", "en", "es", "it", "de", "tr", "sa"][i % 7];
    const base = lg === "all" ? generateGrid(r, { clubPairs: true }) : leagueGrid(lg as never, r);
    if (!base) continue;
    const g = withHonour(base, r, 0.5, lg);
    for (const a of g.rows) for (const b of g.cols) assert.ok(cellSolvable(a, b), `${lg} #${i}: ${a.id} × ${b.id}`);
  }
});

test("quiz questions have their answer among distinct options", () => {
  for (const level of ["easy", "normal", "hard"] as const) {
    for (const cat of ["mixed", "players", "matches"] as const) {
      const qs = quizQuestions(10, cat, level, seededRandom(level.length * 31 + cat.length));
      assert.ok(qs.length > 0, `${cat}/${level} gave no questions`);
      for (const q of qs) {
        assert.ok(q.answer >= 0 && q.answer < q.options.length);
        assert.equal(new Set(q.options.map((o) => o.en)).size, q.options.length, `duplicate option: ${q.text.en}`);
      }
    }
  }
});

test("quiz points: 10 for an instant answer down to 5 at the buzzer", () => {
  assert.equal(quizPoints(0, 15000), 10);
  assert.equal(quizPoints(15000, 15000), 5);
  assert.ok(quizPoints(7000, 15000) < 10 && quizPoints(7000, 15000) > 5);
});

test("card duel: house hands are legal for every theme that can be dealt, under budget", () => {
  for (const theme of THEMES.filter(draftable)) {
    for (let i = 0; i < 20; i++) {
      const hand = houseHand(theme, seededRandom(i + 1));
      assert.equal(hand.length, HAND_SIZE);
      assert.equal(checkHand(hand, theme), "ok", `${theme.id}: ${hand}`);
      assert.ok(handCost(hand) <= BUDGET);
    }
  }
});

test("card duel: illegal hands are refused", () => {
  const theme = THEMES[0];
  const hand = houseHand(theme, seededRandom(3));
  assert.equal(checkHand(hand.slice(1), theme), "size");
  assert.equal(checkHand([...hand.slice(1), hand[1]], theme), "duplicate");
  assert.equal(checkHand([...hand.slice(1), 99999999], theme), "unknown");
});

test("card duel: higher wins, lower wins for 'lower' questions, ties draw", () => {
  // roundWinner takes card ids
  const [lo, hi] = [...CARDS].filter((c) => c.stats.goals > 0).sort((a, b) => a.stats.goals - b.stats.goals).filter((_, i, all) => i === 0 || i === all.length - 1);
  assert.equal(roundWinner({ stat: "goals", lower: false }, hi.id, lo.id), 0);
  assert.equal(roundWinner({ stat: "goals", lower: false }, lo.id, hi.id), 1);
  assert.equal(roundWinner({ stat: "goals", lower: false }, lo.id, lo.id), "draw");
  const tall = [...CARDS].sort((a, b) => b.stats.height - a.stats.height);
  assert.equal(roundWinner({ stat: "height", lower: true }, tall[0].id, tall[tall.length - 1].id), 1);
  assert.equal(dealQuestions(dailyRand(1)).length, dealQuestions(dailyRand(2)).length);
});

test("rondo: clubs are dealt without repeats, answers are judged, the house player stays legal", async () => {
  const { RONDO_CLUBS, RONDO_MAX_ROUNDS, dealRondo, judgeRondo, houseRondoAnswer } = await import("@/lib/rondo");
  assert.ok(RONDO_CLUBS.length >= 10);
  const clubs = dealRondo(seededRandom(9));
  assert.equal(clubs.length, RONDO_MAX_ROUNDS);
  assert.equal(new Set(clubs).size, clubs.length);
  const ok = judgeRondo("Lionel Messi", "barcelona", []);
  assert.ok(ok.ok);
  assert.deepEqual(judgeRondo("Lionel Messi", "barcelona", ["Lionel Messi"]), { ok: false, reason: "used" });
  assert.deepEqual(judgeRondo("Lionel Messi", "fenerbahce", []), { ok: false, reason: "wrong" });
  assert.deepEqual(judgeRondo("zzzqqq", "barcelona", []), { ok: false, reason: "unknown" });
  // every house answer fits the club and is new
  for (const club of clubs) {
    const used: string[] = [];
    const rand = seededRandom(club.length);
    for (let turn = 0; turn < 30; turn++) {
      const name = houseRondoAnswer(club, used, turn, rand);
      if (!name) break;
      const v = judgeRondo(name, club, used);
      assert.ok(v.ok, `${club}: ${name}`);
      used.push(name);
    }
  }
});

test("quiz 'who has more': the right option has the top number, by a real gap", () => {
  let seen = 0;
  for (const level of ["easy", "normal", "hard"] as const) {
    for (const q of quizQuestions(40, "players", level, seededRandom(level.length * 13)).filter((x) => x.values)) {
      seen++;
      const nums = q.values!.map((v) => parseInt(v.en, 10));
      const top = nums[q.answer];
      assert.ok(nums.every((n, i) => i === q.answer || n < top), `${q.text.en}: ${q.values!.map((v) => v.en)}`);
    }
  }
  assert.ok(seen > 0);
});
