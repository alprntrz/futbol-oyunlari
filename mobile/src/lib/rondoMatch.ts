import { useEffect, useRef, useState } from "react";

import { houseRondoAnswer, houseRondoThinkMs, judgeRondo, dealRondo, rondoClubById, rondoPairClubs, RONDO_FIRST_TURN_MS, RONDO_MAX_ROUNDS, RONDO_TARGET, RONDO_TURN_MS, type RondoMode, type RondoVerdict } from "@/lib/rondo";
import type { Criterion } from "@/lib/tiki";

import { getNick } from "./raceSession";
import { getSocket } from "./socket";

/**
 * One Rondo match as the screen sees it, whoever runs it: the server (`rd:*`, online)
 * or this phone (the house player when nobody else was searching). Same shape, so the
 * house player looks and plays like anyone else.
 */
export interface RondoMatch {
  ready: boolean;
  /** "club": take turns on one club; "pair": race on two clubs */
  mode: RondoMode;
  /** rounds (hands) to win, and the most a match can have */
  target: number;
  maxRounds: number;
  club: Criterion | null;
  /** pair mode: the two clubs of this hand */
  pair: [Criterion, Criterion] | null;
  round: number;
  score: { me: number; them: number };
  /** club mode: my turn; pair mode: I may answer now (not locked after a miss) */
  myTurn: boolean;
  /** names said this round, oldest first */
  names: { mine: boolean; name: string }[];
  deadline: number;
  turnMs: number;
  /** `won` null: nobody took the hand (pair mode timeout); `name` who took it with, `answers` the best-known fits */
  roundEnd: RondoRoundEnd | null;
  over: boolean;
  won: boolean;
  /** over with nobody on target (pair mode: hands ran out): a draw */
  draw?: boolean;
  opponent: { nick: string; ref: string | null } | null;
  peerLeft: boolean;
  /** the last wrong try of mine (changes id each time) */
  wrong: { id: number; guess: string; reason: Exclude<RondoVerdict, { ok: true }>["reason"] } | null;
  /** a key for this match (XP, history): changes with a rematch */
  key: string;
  /** +10 s jokers left this match */
  timeJokers: number;
  useTime: () => void;
  answer: (name: string) => void;
  forfeit: () => void;
  /** null: only the host deals the rematch */
  rematch: (() => void) | null;
}

export interface RondoRoundEnd {
  won: boolean | null;
  reason: "timeout" | "forfeit" | "answer" | "left";
  name?: string;
  answers?: string[];
}

type Mark = "X" | "O";
interface ServerRoom {
  code: string;
  mode?: RondoMode;
  target?: number;
  started: boolean;
  round: number;
  club: string | null;
  pair?: string | null;
  score: Record<Mark, number>;
  turn: Mark;
  remainingMs: number;
  turnMs: number;
  names: { mark: Mark; name: string }[];
  locked?: Record<Mark, number>;
  roundEnd: { winner: Mark | null; reason: "timeout" | "forfeit" | "answer" | "left"; name?: string; answers?: string[] } | null;
  /** pair mode: over with no winner (both idle for a few hands) */
  ended?: boolean;
  winner: Mark | null;
  jokers?: Record<Mark, { time: number }>;
  players: { id: string; ref?: string | null; nick: string; mark: Mark }[];
}

/** Online: the server's room (`rd:update`), answers go to the server, which judges them. */
export function useRondoOnline(code: string): RondoMatch & { room: ServerRoom | null; error: string | null; myId: string } {
  const [room, setRoom] = useState<ServerRoom | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [peerLeft, setPeerLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");
  const [wrong, setWrong] = useState<RondoMatch["wrong"]>(null);
  const [games, setGames] = useState(0);
  // pair mode: my box is locked until then after a miss
  const [lockedUntil, setLockedUntil] = useState<Record<Mark, number>>({ X: 0, O: 0 });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: ServerRoom) => {
      setRoom((prev) => {
        if ((prev?.winner || prev?.ended) && !r.winner && !r.ended) setGames((g) => g + 1);
        return r;
      });
      setDeadline(r.remainingMs ? Date.now() + r.remainingMs : 0);
      const at = Date.now();
      setNow(at);
      setLockedUntil({ X: r.locked?.X ? at + r.locked.X : 0, O: r.locked?.O ? at + r.locked.O : 0 });
    };
    // events of another room (an older game this phone was in) are not this screen's
    const onUpdate = (r: ServerRoom) => {
      if (r.code !== code) return;
      setPeerLeft(false);
      apply(r);
    };
    const onLeft = (r: ServerRoom) => {
      if (r.code !== code) return;
      setPeerLeft(true);
      apply(r);
    };
    const onWrong = (w: { guess: string; reason: "unknown" | "wrong" | "used" }) => setWrong((p) => ({ id: (p?.id ?? 0) + 1, ...w }));
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("rd:update", onUpdate);
    socket.on("rd:peer-left", onLeft);
    socket.on("rd:wrong", onWrong);
    socket.on("connect", onConnect);
    socket.emit("rd:join", { code, nick: getNick() }, (res: { ok: boolean; error?: string; room?: ServerRoom }) => {
      if (res.ok && res.room) apply(res.room);
      else setError(res.error === "full" ? "full" : res.error === "update" ? "update" : "not_found");
    });
    return () => {
      socket.off("rd:update", onUpdate);
      socket.off("rd:peer-left", onLeft);
      socket.off("rd:wrong", onWrong);
      socket.off("connect", onConnect);
      socket.emit("rd:leave", { code });
    };
  }, [code]);

  const me = room?.players.find((p) => p.id === myId);
  const them = room?.players.find((p) => p.id !== myId);
  const mark = me?.mark ?? "X";
  const other: Mark = mark === "X" ? "O" : "X";
  const isHost = room?.players[0]?.id === myId;
  const mode: RondoMode = room?.mode === "pair" ? "pair" : "club";
  const target = room?.target ?? RONDO_TARGET;
  const lockLeft = Math.max(0, lockedUntil[mark] - now);
  useEffect(() => {
    if (lockLeft <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), lockLeft);
    return () => clearTimeout(id);
  }, [lockLeft]);
  const live = !!room?.started && !room.roundEnd && !room.winner && !room.ended;
  return {
    room,
    error,
    myId,
    ready: !!room?.started,
    mode,
    target,
    maxRounds: target * 2 - 1,
    club: room?.club ? (rondoClubById(room.club) ?? null) : null,
    pair: room?.pair ? rondoPairClubs(room.pair) : null,
    round: room?.round ?? 0,
    score: { me: room?.score[mark] ?? 0, them: room?.score[other] ?? 0 },
    myTurn: live && (mode === "pair" ? lockLeft <= 0 : room!.turn === mark),
    names: (room?.names ?? []).map((n) => ({ mine: n.mark === mark, name: n.name })),
    deadline,
    turnMs: room?.turnMs || RONDO_TURN_MS,
    roundEnd: room?.roundEnd ? { won: room.roundEnd.winner === null ? null : room.roundEnd.winner === mark, reason: room.roundEnd.reason, name: room.roundEnd.name, answers: room.roundEnd.answers } : null,
    over: !!room?.winner || !!room?.ended,
    won: room?.winner === mark,
    draw: !!room?.ended && !room.winner,
    opponent: them ? { nick: them.nick, ref: them.ref ?? null } : null,
    peerLeft,
    wrong,
    key: `rd-${code}-${games}`,
    timeJokers: room?.jokers?.[mark]?.time ?? 0,
    useTime: () => getSocket().emit("rd:joker", { kind: "time" }),
    answer: (name) => getSocket().emit("rd:answer", { name }),
    forfeit: () => getSocket().emit("rd:forfeit"),
    rematch: isHost && !peerLeft ? () => getSocket().emit("rd:rematch") : null,
  };
}

const ROUND_GAP_MS = 3_000;

/** The house player, on this phone: the same rules (src/lib/rondo.ts), human-like timing. */
export function useRondoHouse(nick: string, ref: string): RondoMatch {
  const [game, setGame] = useState(0);
  const [clubs, setClubs] = useState(() => dealRondo());
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ me: 0, them: 0 });
  const [myTurn, setMyTurn] = useState(true);
  const [names, setNames] = useState<RondoMatch["names"]>([]);
  const [deadline, setDeadline] = useState(() => Date.now() + RONDO_FIRST_TURN_MS);
  const [turnMs, setTurnMs] = useState(RONDO_FIRST_TURN_MS);
  const [roundEnd, setRoundEnd] = useState<RondoMatch["roundEnd"]>(null);
  const [wrong, setWrong] = useState<RondoMatch["wrong"]>(null);
  const [timeJokers, setTimeJokers] = useState(1);
  const over = score.me >= RONDO_TARGET || score.them >= RONDO_TARGET;
  const used = useRef<string[]>([]);

  const startTurn = (mine: boolean, ms: number) => {
    setMyTurn(mine);
    setTurnMs(ms);
    setDeadline(Date.now() + ms);
  };

  const endRound = (iWon: boolean, reason: "timeout" | "forfeit") => {
    setRoundEnd({ won: iWon, reason });
    setDeadline(0);
    setScore((s) => (iWon ? { ...s, me: s.me + 1 } : { ...s, them: s.them + 1 }));
  };

  // the clock: whoever's turn it is loses the round when it runs out
  useEffect(() => {
    if (!deadline || roundEnd || over) return;
    const id = setTimeout(() => endRound(!myTurn, "timeout"), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
  }, [deadline, myTurn, roundEnd, over]);

  // the house player's turn: think, then answer (or blank and let the clock run out)
  useEffect(() => {
    if (myTurn || roundEnd || over || !deadline) return;
    const think = houseRondoThinkMs();
    const id = setTimeout(() => {
      const name = houseRondoAnswer(clubs[round], used.current, used.current.length);
      if (!name) return;
      used.current = [...used.current, name];
      setNames((n) => [...n, { mine: false, name }]);
      startTurn(true, RONDO_TURN_MS);
    }, think);
    return () => clearTimeout(id);
  }, [myTurn, roundEnd, over, deadline, clubs, round]);

  // next club after a short pause; the other side starts it
  useEffect(() => {
    if (!roundEnd || over) return;
    const id = setTimeout(() => {
      const next = round + 1;
      setRound(next);
      setNames([]);
      used.current = [];
      setRoundEnd(null);
      startTurn(next % 2 === 0, RONDO_FIRST_TURN_MS);
    }, ROUND_GAP_MS);
    return () => clearTimeout(id);
  }, [roundEnd, over, round]);

  return {
    ready: true,
    mode: "club",
    target: RONDO_TARGET,
    maxRounds: RONDO_MAX_ROUNDS,
    club: rondoClubById(clubs[round]) ?? null,
    pair: null,
    round,
    score,
    myTurn: myTurn && !roundEnd && !over,
    names,
    deadline,
    turnMs,
    roundEnd,
    over,
    won: score.me >= RONDO_TARGET,
    opponent: { nick, ref },
    peerLeft: false,
    wrong,
    key: `rd-house-${ref}-${game}`,
    timeJokers,
    useTime: () => {
      if (!myTurn || roundEnd || over || timeJokers <= 0) return;
      setTimeJokers((n) => n - 1);
      const left = Math.max(0, deadline - Date.now()) + 10_000;
      setTurnMs(Math.max(left, RONDO_TURN_MS));
      setDeadline(Date.now() + left);
    },
    answer: (guess) => {
      if (!myTurn || roundEnd || over) return;
      const v = judgeRondo(guess, clubs[round], used.current);
      if (!v.ok) return setWrong((p) => ({ id: (p?.id ?? 0) + 1, guess, reason: v.reason }));
      used.current = [...used.current, v.player.name];
      setNames((n) => [...n, { mine: true, name: v.player.name }]);
      startTurn(false, RONDO_TURN_MS);
    },
    forfeit: () => {
      if (over) return;
      setScore((s) => ({ ...s, them: RONDO_TARGET }));
      setRoundEnd({ won: false, reason: "forfeit" });
      setDeadline(0);
    },
    rematch: () => {
      setGame((g) => g + 1);
      setClubs(dealRondo());
      setRound(0);
      setScore({ me: 0, them: 0 });
      setNames([]);
      used.current = [];
      setRoundEnd(null);
      setWrong(null);
      setTimeJokers(1);
      startTurn(true, RONDO_FIRST_TURN_MS);
    },
  };
}
