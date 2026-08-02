export type Difficulty = "normal" | "hard";

export interface LineupPlayer {
  /** Full display name, shown after the slot is solved */
  name: string;
  /** Uppercase ASCII answer the user must guess (no spaces/diacritics) */
  answer: string;
  /** Shirt number shown on the jersey */
  number: number;
  captain?: boolean;
  /** Goals scored by this player in the match (shown as ball icons) */
  goals?: number;
}

export interface Match {
  id: string;
  /** Competition name, e.g. "UEFA Şampiyonlar Ligi Finali" */
  competition: { tr: string; en: string };
  season: string;
  date: string; // dd.mm.yyyy
  /** The team whose XI is being guessed */
  team: string;
  opponent: string;
  score: string; // e.g. "3-3 (3-2 pen)"
  formation: FormationKey;
  /** Ordered GK-first, matching the formation slot order */
  lineup: LineupPlayer[];
  /** Primary kit colors for the pixel jersey */
  kit: { body: string; sleeves: string; number: string };
  difficulty?: Difficulty; // suggested difficulty bucket
  /** Collection tags, e.g. "turkiye" for Turkish-team matches */
  tags?: string[];
}

export type FormationKey =
  | "4-3-3"
  | "4-2-3-1"
  | "4-4-2"
  | "4-3-1-2"
  | "4-4-1-1"
  | "3-4-1-2"
  | "3-4-3d"
  | "3-5-2"
  | "3-4-2-1"
  | "3-2-4-1"
  | "4-1-4-1"
  | "4-2-4";

export interface SlotState {
  solved: boolean;
  failed: boolean;
  guesses: string[]; // past guesses (uppercase)
}

export type TileMark = "correct" | "present" | "absent";
