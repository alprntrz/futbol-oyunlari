import type { GridPlayer } from "@/data/players";
import { AR_PLAYERS } from "@/data/players-ar";

import { GRID_PLAYERS, searchPlayers as searchLatin } from "./tiki";

/**
 * Arabic keyboard search for the app. Kept out of tiki.ts so the server and the web bundle don't
 * carry the names: the phone turns what was typed into the Latin name, and everything after that
 * (validateCell, the server's judging) works as it always did.
 */

const ARABIC = /[؀-ۿ]/;
const MIN_QUERY = 2;

/** Folds spellings Arabic typists mix up: vowel marks, tatweel, hamza seats, final ya / ta marbuta. */
export function normalizeArabic(raw: string): string {
  return raw
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

let index: { player: GridPlayer; names: string[] }[] | null = null;
function arabicIndex() {
  index ??= GRID_PLAYERS.flatMap((player) => {
    const names = AR_PLAYERS[player.name];
    return names ? [{ player, names: names.split("|").map(normalizeArabic) }] : [];
  });
  return index;
}

/** Autocomplete for either keyboard; players stay in fame order. */
export function searchPlayers(query: string, limit = 8): GridPlayer[] {
  if (!ARABIC.test(query)) return searchLatin(query, limit);
  const q = normalizeArabic(query);
  if (q.length < MIN_QUERY) return [];
  const starts: GridPlayer[] = [];
  const contains: GridPlayer[] = [];
  for (const { player, names } of arabicIndex()) {
    if (names.some((n) => n.split(" ").some((word) => word.startsWith(q)))) starts.push(player);
    else if (names.some((n) => n.includes(q))) contains.push(player);
  }
  return [...starts, ...contains].slice(0, limit);
}

/**
 * A typed answer as the rules read it. An Arabic full name becomes the Latin name; a bare surname
 * becomes the Latin surname, so the judge still tries every player called that ("سيلفا" → "Silva").
 */
export function latinGuess(text: string): string {
  if (!ARABIC.test(text)) return text;
  const q = normalizeArabic(text);
  // Wikidata lists one-word nicknames too, so only a name with a space counts as a full name
  const full = q.includes(" ") ? arabicIndex().find(({ names }) => names.includes(q)) : undefined;
  if (full) return full.player.name;
  const surname = arabicIndex().find(({ names }) => names.some((n) => n.split(" ").at(-1) === q));
  return surname?.player.name.split(" ").at(-1) ?? text;
}
