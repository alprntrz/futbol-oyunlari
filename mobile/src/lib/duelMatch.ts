import { useEffect, useRef, useState } from "react";

import { dailyRand, dealQuestions, housePick, PICK_SECONDS, roundWinner, ROUNDS, type Question } from "@/lib/duel";

import { getSocket } from "./socket";

/** both cards stay face up this long before the next question (server.js DZ_REVEAL_MS) */
export const REVEAL_MS = 2800;

export type RoundResult = { question: Question; mine: number; theirs: number; winner: "me" | "them" | "draw" };

/** One Card Duel match as the screen sees it, whoever runs it (this phone or server.js). */
export interface DuelMatch {
  round: number;
  question: Question | null;
  /** the pick clock runs out at (ms); 0 = no pick open (reveal or not started) */
  deadline: number;
  results: RoundResult[];
  score: [number, number];
  over: boolean;
  myPick: number | null;
  theyPicked: boolean;
  peerLeft: boolean;
  pick: (card: number) => void;
  /** another match with the same hands (online: rematch) */
  again: () => void;
  /** on this phone only: freeze / resume the pick clock (a walkthrough is up) */
  hold?: (on: boolean) => void;
  /** ms left on a frozen clock, else null */
  heldMs?: number | null;
}

const scoreOf = (results: RoundResult[]): [number, number] => [results.filter((r) => r.winner === "me").length, results.filter((r) => r.winner === "them").length];

/**
 * Against the house player on this phone. `seed` set = the daily duel (seeded
 * questions, same for everyone); otherwise random. The house player takes a
 * human-looking 2–9 s and never shows as a bot.
 */
export function useLocalDuel(myHand: number[], houseHand: number[], seed: number | null): DuelMatch {
  const [s, setS] = useState<LocalState>(() => fresh(dealQuestions(seed !== null ? dailyRand(seed) : Math.random)));
  const { questions, results, deadline, myPick, theirPick, held } = s;
  const round = results.length;
  const over = round >= ROUNDS;
  const rand = useRef(seed !== null ? dailyRand(seed + 1) : Math.random);

  // the house player thinks, then picks
  useEffect(() => {
    if (over || !deadline || theirPick !== null || held !== null) return;
    const used = results.map((r) => r.theirs);
    const unused = houseHand.filter((id) => !used.includes(id));
    const card = housePick(questions[round], unused, questions.slice(round + 1), rand.current);
    const id = setTimeout(() => setS((p) => settle({ ...p, theirPick: card })), 2000 + Math.random() * 7000);
    return () => clearTimeout(id);
  }, [over, deadline, theirPick, held, round, questions, results, houseHand]);

  // my clock: a random unused card when it runs out
  useEffect(() => {
    if (over || !deadline || myPick !== null || held !== null) return;
    const used = results.map((r) => r.mine);
    const unused = myHand.filter((c) => !used.includes(c));
    const card = unused[Math.floor(Math.random() * unused.length)];
    const id = setTimeout(() => setS((p) => settle({ ...p, myPick: card })), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [over, deadline, myPick, held, results, myHand]);

  // after the reveal, the next question
  useEffect(() => {
    if (deadline || over || round === 0) return;
    const id = setTimeout(() => setS((p) => ({ ...p, myPick: null, theirPick: null, deadline: Date.now() + PICK_SECONDS * 1000 })), REVEAL_MS);
    return () => clearTimeout(id);
  }, [deadline, over, round]);

  return {
    round,
    question: over ? null : questions[round],
    deadline,
    results,
    score: scoreOf(results),
    over,
    myPick,
    theyPicked: theirPick !== null,
    peerLeft: false,
    pick: (card) => {
      if (!deadline || myPick !== null || results.some((r) => r.mine === card)) return;
      setS((p) => settle({ ...p, myPick: card }));
    },
    again: () => setS(fresh(dealQuestions(Math.random))),
    hold: (on) =>
      setS((p) => {
        if (on) return p.deadline && p.held === null ? { ...p, held: Math.max(0, p.deadline - Date.now()) } : p;
        return p.held !== null ? { ...p, held: null, deadline: p.deadline ? Date.now() + p.held : 0 } : p;
      }),
    heldMs: held,
  };
}

interface LocalState {
  questions: Question[];
  results: RoundResult[];
  deadline: number;
  myPick: number | null;
  theirPick: number | null;
  /** ms left while the clock is frozen */
  held: number | null;
}

const fresh = (questions: Question[]): LocalState => ({ questions, results: [], deadline: Date.now() + PICK_SECONDS * 1000, myPick: null, theirPick: null, held: null });

/** both cards in: judge the round and close the pick (the reveal starts) */
function settle(p: LocalState): LocalState {
  if (p.myPick === null || p.theirPick === null || !p.deadline) return p;
  const q = p.questions[p.results.length];
  const w = roundWinner(q, p.myPick, p.theirPick);
  return { ...p, deadline: 0, results: [...p.results, { question: q, mine: p.myPick, theirs: p.theirPick, winner: w === "draw" ? "draw" : w === 0 ? "me" : "them" }] };
}

interface ServerState {
  game: number;
  round: number;
  question: Question | null;
  deadline: number;
  picked: [boolean, boolean];
  results: { question: Question; cards: [number, number]; winner: 0 | 1 | "draw" }[];
  over: boolean;
  players: { id: string; ref?: string | null; nick: string; side: 0 | 1; tier: number | null }[];
}

/** An online match run by server.js (`dz:*`); this phone already joined room `code`. */
export function useOnlineDuel(code: string): DuelMatch & { opponent: string | null; opponentRef: string | null; game: number } {
  const [state, setState] = useState<ServerState | null>(null);
  const [peerLeft, setPeerLeft] = useState(false);
  const [myPick, setMyPick] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (s: ServerState) => {
      setState(s);
      setPeerLeft(false);
    };
    const onLeft = (s: ServerState) => {
      setState(s);
      setPeerLeft(true);
    };
    socket.on("dz:update", onUpdate);
    socket.on("dz:peer-left", onLeft);
    socket.emit("dz:sync");
    return () => {
      socket.off("dz:update", onUpdate);
      socket.off("dz:peer-left", onLeft);
      socket.emit("dz:leave");
    };
  }, [code]);

  const socketId = getSocket().id;
  const me = state?.players.find((p) => p.id === socketId);
  const side = me?.side ?? 0;
  const them = state?.players.find((p) => p.id !== socketId);
  const results: RoundResult[] = (state?.results ?? []).map((r) => ({
    question: r.question,
    mine: r.cards[side],
    theirs: r.cards[1 - side],
    winner: r.winner === "draw" ? "draw" : r.winner === side ? "me" : "them",
  }));
  // a pick belongs to its round
  const [pickRound, setPickRound] = useState(-1);
  const round = state?.round ?? 0;
  const pickNow = pickRound === round ? myPick : null;

  return {
    round,
    question: state?.question ?? null,
    deadline: state?.deadline ?? 0,
    results,
    score: scoreOf(results),
    over: !!state?.over,
    myPick: pickNow ?? (state?.picked[side] ? -1 : null),
    theyPicked: !!state?.picked[1 - side],
    peerLeft,
    opponent: them?.nick ?? null,
    opponentRef: them?.ref ?? null,
    game: state?.game ?? 0,
    pick: (card) => {
      if (!state?.deadline || pickNow !== null) return;
      setMyPick(card);
      setPickRound(round);
      getSocket().emit("dz:pick", { card });
    },
    again: () => getSocket().emit("dz:rematch"),
  };
}
