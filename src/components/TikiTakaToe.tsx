"use client";

import { useEffect, useMemo, useState } from "react";
import type { GridPlayer } from "@/data/players";
import { useI18n } from "@/lib/i18n";
import { generateGrid, searchPlayers, validateCell, type Criterion, type Grid } from "@/lib/tiki";

type Mark = "X" | "O";
interface Cell { mark: Mark; player: GridPlayer; }

const TURN_SECONDS = 45;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// ---------- placeholder visuals (original, no third-party assets) ----------
function initials(name: string) {
  const t = name.trim().split(/\s+/);
  return ((t[0]?.[0] ?? "") + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 42% 38%)`;
}
function PlayerAvatar({ p, size }: { p: GridPlayer; size: number }) {
  if (p.photo) return <img src={p.photo} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full font-black text-white/90"
      style={{ width: size, height: size, background: avatarColor(p.name), fontSize: size * 0.38 }}>
      {initials(p.name)}
    </div>
  );
}
function ClubCrest({ c, size = 26 }: { c: Criterion; size?: number }) {
  if (c.crest) return <img src={c.crest} alt="" className="object-contain" style={{ width: size, height: size }} />;
  return (
    <div className="flex shrink-0 items-center justify-center rounded-md font-black"
      style={{ width: size, height: size, background: c.c1, color: c.c2, border: `1px solid ${c.c2}44`, fontSize: size * 0.32 }}>
      {c.short}
    </div>
  );
}
function CriterionHeader({ c, label }: { c: Criterion; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-1 text-center leading-tight">
      {c.kind === "club" ? <ClubCrest c={c} /> : <span className="text-xl">{c.icon}</span>}
      <span className="text-[9px] font-bold text-zinc-200 sm:text-[11px]">{label}</span>
    </div>
  );
}

export function TikiTakaToe() {
  const { t, locale } = useI18n();
  const [grid, setGrid] = useState<Grid | null>(null);
  const [board, setBoard] = useState<(Cell | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [winner, setWinner] = useState<Mark | "draw" | null>(null);
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);

  const label = (c: Criterion) => (locale === "tr" ? c.tr : c.en);
  const suggestions = useMemo(() => searchPlayers(input), [input]);

  function newGrid() {
    setGrid(generateGrid());
    setBoard(Array(9).fill(null));
    setTurn("X");
    setUsed(new Set());
    setWinner(null);
    setOpenCell(null);
    setInput("");
    setFlash(null);
    setTimeLeft(TURN_SECONDS);
  }
  useEffect(() => { newGrid(); }, []);

  // per-turn countdown
  useEffect(() => {
    if (winner || !grid) return;
    const id = setInterval(() => setTimeLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [winner, grid]);
  // reset the clock whenever the turn (or grid) changes
  useEffect(() => { setTimeLeft(TURN_SECONDS); }, [turn, grid]);
  // time up → pass the turn
  useEffect(() => {
    if (timeLeft === 0 && grid && !winner) {
      setFlash(`${turn}: ${t("ttTimeout")}`);
      setOpenCell(null);
      setInput("");
      setTurn((m) => (m === "X" ? "O" : "X"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const winningLine = useMemo(() => {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (board[a] && board[b] && board[c] && board[a]!.mark === board[b]!.mark && board[b]!.mark === board[c]!.mark) return line;
    }
    return null;
  }, [board]);

  function submit(text?: string) {
    const guess = (text ?? input).trim();
    if (openCell === null || !grid || !guess) return;
    const row = grid.rows[Math.floor(openCell / 3)];
    const col = grid.cols[openCell % 3];
    const player = validateCell(guess, row, col, used);
    if (!player) {
      setFlash(`${turn}: ${t("ttWrong")}`);
      setTurn((m) => (m === "X" ? "O" : "X"));
      setOpenCell(null);
      setInput("");
      return;
    }
    const nextBoard = board.slice();
    nextBoard[openCell] = { mark: turn, player };
    const nextUsed = new Set(used); nextUsed.add(player.name);
    setBoard(nextBoard);
    setUsed(nextUsed);
    setOpenCell(null);
    setInput("");
    setFlash(null);
    let win: Mark | "draw" | null = null;
    for (const [a, b, c] of LINES) {
      if (nextBoard[a] && nextBoard[b] && nextBoard[c] && nextBoard[a]!.mark === nextBoard[b]!.mark && nextBoard[b]!.mark === nextBoard[c]!.mark) { win = nextBoard[a]!.mark; break; }
    }
    if (!win && nextBoard.every(Boolean)) {
      const x = nextBoard.filter((c) => c?.mark === "X").length;
      win = x === nextBoard.length - x ? "draw" : x > nextBoard.length - x ? "X" : "O";
    }
    if (win) setWinner(win);
    else setTurn((m) => (m === "X" ? "O" : "X"));
  }

  if (!grid) return null;

  const markColor = (m: Mark) => (m === "X" ? "text-indigo-400" : "text-rose-400");
  const turnBg = turn === "X" ? "bg-indigo-600" : "bg-rose-600";
  const low = timeLeft <= 10;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {/* status + timer */}
      {winner ? (
        <div className="text-2xl font-black text-white">{winner === "draw" ? t("ttDraw") : `${winner} ${t("ttWins")}`}</div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <div className={`rounded-full ${turnBg} px-5 py-1.5 text-base font-black text-white`}>{t("ttTurn")}: {turn}</div>
            <div className="flex items-baseline gap-1">
              <span className={`text-5xl font-black tabular-nums leading-none ${low ? "animate-pulse text-rose-500" : "text-white"}`}>{timeLeft}</span>
              <span className="text-sm font-bold text-zinc-500">{locale === "tr" ? "sn" : "s"}</span>
            </div>
          </div>
          <div className="h-2 w-56 max-w-full overflow-hidden rounded-full bg-zinc-800">
            <div className={`h-full transition-all duration-1000 ease-linear ${low ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${(timeLeft / TURN_SECONDS) * 100}%` }} />
          </div>
          {flash && <div className="text-xs font-bold text-rose-400">{flash}</div>}
        </div>
      )}

      {/* grid */}
      <div className="grid w-full grid-cols-[1.1fr_1fr_1fr_1fr] gap-1.5">
        <div className="aspect-square" />
        {grid.cols.map((c, i) => (
          <div key={i} className="flex aspect-square items-center justify-center rounded-lg bg-zinc-800">
            <CriterionHeader c={c} label={label(c)} />
          </div>
        ))}
        {grid.rows.map((r, ri) => (
          <RowFragment key={ri}>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-zinc-800">
              <CriterionHeader c={r} label={label(r)} />
            </div>
            {grid.cols.map((_, ci) => {
              const idx = ri * 3 + ci;
              const cell = board[idx];
              const inWin = winningLine?.includes(idx);
              return (
                <button
                  key={ci}
                  disabled={!!cell || !!winner}
                  onClick={() => { setOpenCell(idx); setInput(""); setFlash(null); }}
                  className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border-2 p-1 text-center transition ${
                    cell ? (inWin ? "border-emerald-400 bg-emerald-900/40" : "border-zinc-700 bg-zinc-900") : "border-zinc-700 bg-zinc-900/50 hover:border-indigo-500 hover:bg-zinc-800"
                  }`}
                >
                  {cell ? (
                    <>
                      <span className={`text-3xl font-black leading-none sm:text-4xl ${markColor(cell.mark)}`}>{cell.mark}</span>
                      <span className="line-clamp-2 text-[8px] leading-tight text-zinc-300 sm:text-[10px]">{cell.player.name}</span>
                    </>
                  ) : (
                    <span className="text-2xl text-zinc-600">+</span>
                  )}
                </button>
              );
            })}
          </RowFragment>
        ))}
      </div>

      <button onClick={newGrid} className="rounded-lg border border-zinc-600 px-4 py-1.5 text-sm font-bold text-zinc-300 hover:bg-zinc-800">{t("ttNewGrid")}</button>
      <p className="text-center text-xs text-zinc-500">{t("ttHint")}</p>

      {/* guess modal with live autocomplete */}
      {openCell !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setOpenCell(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-center gap-2 text-center text-sm font-bold text-white">
              <span className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1">
                {grid.rows[Math.floor(openCell / 3)].kind === "club" && <ClubCrest c={grid.rows[Math.floor(openCell / 3)]} size={18} />}
                {label(grid.rows[Math.floor(openCell / 3)])}
              </span>
              <span className="text-zinc-500">×</span>
              <span className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1">
                {grid.cols[openCell % 3].kind === "club" && <ClubCrest c={grid.cols[openCell % 3]} size={18} />}
                {label(grid.cols[openCell % 3])}
              </span>
            </div>
            <div className={`mb-2 text-center text-xs font-bold ${markColor(turn)}`}>{turn} — {t("ttYourGuess")}</div>
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (suggestions.length === 1) submit(suggestions[0].name); else submit(); } }}
              placeholder={t("ttPlaceholder")}
              className="w-full rounded-lg bg-zinc-800 px-3 py-2 text-white outline-none ring-2 ring-transparent focus:ring-indigo-500"
            />
            {/* suggestions */}
            {input.trim().length >= 2 && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-800">
                {suggestions.length === 0 ? (
                  <div className="px-3 py-2 text-center text-xs text-zinc-500">{t("ttNoResult")}</div>
                ) : (
                  suggestions.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => submit(p.name)}
                      disabled={used.has(p.name)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-zinc-800 disabled:opacity-40"
                    >
                      <PlayerAvatar p={p} size={28} />
                      <span className="flex-1 text-sm font-medium text-zinc-100">{p.name}</span>
                      {used.has(p.name) && <span className="text-[10px] text-zinc-500">✓</span>}
                    </button>
                  ))
                )}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={() => setOpenCell(null)} className="flex-1 rounded-lg border border-zinc-700 py-2 text-sm font-bold text-zinc-300 hover:bg-zinc-800">{t("close")}</button>
              <button onClick={() => submit()} className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white hover:bg-indigo-500">{t("ttSubmit")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
