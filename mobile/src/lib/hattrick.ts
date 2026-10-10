import { ALL_CRITERIA, type Grid } from "@/lib/tiki";

/** Hat-trick (3×3 criteria grid) rules shared by the same-phone and online modes. */
export type Mark = "X" | "O";
export interface HtCell {
  mark: Mark;
  name: string;
}
export type Winner = Mark | "draw" | null;

export const TURN_SECONDS = 45;

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export const other = (m: Mark): Mark => (m === "X" ? "O" : "X");

export function winningLine(board: (HtCell | null)[]): number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line.map((i) => board[i]);
    if (a && b && c && a.mark === b.mark && b.mark === c.mark) return line;
  }
  return null;
}

/** Three in a row wins; a full board goes to whoever holds more squares. */
export function resultOf(board: (HtCell | null)[]): Winner {
  const line = winningLine(board);
  if (line) return board[line[0]]!.mark;
  if (!board.every(Boolean)) return null;
  const x = board.filter((c) => c?.mark === "X").length;
  return x === 9 - x ? "draw" : x > 9 - x ? "X" : "O";
}

/** Grids travel over the network as criterion ids. */
export const gridToIds = (g: Grid) => ({ rows: g.rows.map((c) => c.id), cols: g.cols.map((c) => c.id) });

export function gridFromIds(ids: { rows: string[]; cols: string[] }): Grid {
  const by = (id: string) => ALL_CRITERIA.find((c) => c.id === id)!;
  return { rows: ids.rows.map(by), cols: ids.cols.map(by) };
}
