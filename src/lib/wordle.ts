import type { TileMark } from "./types";

/** Uppercase + strip diacritics + drop non A-Z, so "Şükür" → "SUKUR". */
export function normalizeAnswer(raw: string): string {
  return raw
    .toUpperCase()
    .replaceAll("İ", "I")
    .replaceAll("Ş", "S")
    .replaceAll("Ğ", "G")
    .replaceAll("Ü", "U")
    .replaceAll("Ö", "O")
    .replaceAll("Ç", "C")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "");
}

/** Letters of an answer, ignoring word-boundary spaces ("DI MARIA" → "DIMARIA"). */
export function answerLetters(answer: string): string {
  return answer.replace(/ /g, "");
}

/** Classic Wordle evaluation with correct duplicate handling (letters only). */
export function evaluateGuess(guess: string, rawAnswer: string): TileMark[] {
  const answer = answerLetters(rawAnswer);
  const n = answer.length;
  const marks: TileMark[] = new Array(n).fill("absent");
  const remaining: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] ?? 0) + 1;
    }
  }
  for (let i = 0; i < n; i++) {
    if (marks[i] === "correct") continue;
    const ch = guess[i];
    if (remaining[ch] > 0) {
      marks[i] = "present";
      remaining[ch]--;
    }
  }
  return marks;
}

/** Merge the best-known keyboard state from a set of guesses. */
export function keyboardState(
  guesses: string[],
  rawAnswer: string
): Record<string, TileMark> {
  const rank: Record<TileMark, number> = { absent: 0, present: 1, correct: 2 };
  const state: Record<string, TileMark> = {};
  for (const g of guesses) {
    const marks = evaluateGuess(g, rawAnswer);
    for (let i = 0; i < g.length; i++) {
      const prev = state[g[i]];
      if (!prev || rank[marks[i]] > rank[prev]) state[g[i]] = marks[i];
    }
  }
  return state;
}
