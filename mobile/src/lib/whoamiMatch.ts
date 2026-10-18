import { useEffect, useState } from "react";

import { WM_HEARTS, WM_MAX_TURNS, WM_TURN_MS, wmAnswer, wmDeal, wmHouseMove, wmIsRight, type WmQuestion } from "@/lib/whoami";

import { getNick } from "./raceSession";
import { getSocket } from "./socket";

/** One line of the shared log: a question and its answer, a guess, or a turn that ran out. */
export type WmEntry = { mine: boolean } & ({ q: WmQuestion; yes: boolean } | { guess: string; right: boolean } | { timeout: true });

/**
 * One Who Am I? match as the screen sees it, whoever runs it: the server (`wm:*`, online,
 * the hidden player stays there) or this phone (the house player). Same shape either way.
 */
export interface WmMatch {
  ready: boolean;
  myTurn: boolean;
  deadline: number;
  turnMs: number;
  turns: number;
  hearts: { me: number; them: number };
  log: WmEntry[];
  over: boolean;
  won: boolean;
  draw: boolean;
  endReason: "named" | "hearts" | "turns" | "forfeit" | null;
  /** the hidden player's name, once it's over */
  hidden: string | null;
  opponent: { nick: string; ref: string | null } | null;
  peerLeft: boolean;
  key: string;
  ask: (q: WmQuestion) => void;
  guess: (name: string) => void;
  forfeit: () => void;
  /** null: only the host deals the rematch */
  rematch: (() => void) | null;
}

type Mark = "X" | "O";
type ServerEntry = { mark: Mark } & ({ q: WmQuestion; yes: boolean } | { guess: string; right: boolean } | { timeout: true });
interface ServerRoom {
  code: string;
  started: boolean;
  turn: Mark;
  turns: number;
  remainingMs: number;
  turnMs: number;
  hearts: Record<Mark, number>;
  log: ServerEntry[];
  winner: Mark | "draw" | null;
  endReason: WmMatch["endReason"];
  hidden: string | null;
  players: { id: string; ref?: string | null; nick: string; mark: Mark }[];
}

/** Online: the server's room (`wm:update`); questions and guesses go to the server, which answers. */
export function useWmOnline(code: string): WmMatch & { room: ServerRoom | null; error: string | null; myId: string } {
  const [room, setRoom] = useState<ServerRoom | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [peerLeft, setPeerLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");
  const [games, setGames] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: ServerRoom) => {
      setRoom((prev) => {
        if (prev?.winner && !r.winner) setGames((g) => g + 1);
        return r;
      });
      setDeadline(r.remainingMs ? Date.now() + r.remainingMs : 0);
    };
    const onUpdate = (r: ServerRoom) => {
      setPeerLeft(false);
      apply(r);
    };
    const onLeft = (r: ServerRoom) => {
      setPeerLeft(true);
      apply(r);
    };
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("wm:update", onUpdate);
    socket.on("wm:peer-left", onLeft);
    socket.on("connect", onConnect);
    socket.emit("wm:join", { code, nick: getNick() }, (res: { ok: boolean; error?: string; room?: ServerRoom }) => {
      if (res.ok && res.room) apply(res.room);
      else setError(res.error === "full" ? "full" : "not_found");
    });
    return () => {
      socket.off("wm:update", onUpdate);
      socket.off("wm:peer-left", onLeft);
      socket.off("connect", onConnect);
    };
  }, [code]);

  const me = room?.players.find((p) => p.id === myId);
  const them = room?.players.find((p) => p.id !== myId);
  const mark: Mark = me?.mark ?? "X";
  const other: Mark = mark === "X" ? "O" : "X";
  const isHost = room?.players[0]?.id === myId;
  return {
    room,
    error,
    myId,
    ready: !!room?.started,
    myTurn: !!room?.started && !room.winner && room.turn === mark && !peerLeft,
    deadline,
    turnMs: room?.turnMs || WM_TURN_MS,
    turns: room?.turns ?? 0,
    hearts: { me: room?.hearts[mark] ?? WM_HEARTS, them: room?.hearts[other] ?? WM_HEARTS },
    log: (room?.log ?? []).map(({ mark: m, ...e }) => ({ ...e, mine: m === mark }) as WmEntry),
    over: !!room?.winner,
    won: room?.winner === mark,
    draw: room?.winner === "draw",
    endReason: room?.endReason ?? null,
    hidden: room?.hidden ?? null,
    opponent: them ? { nick: them.nick, ref: them.ref ?? null } : null,
    peerLeft,
    key: `wm-${code}-${games}`,
    ask: (q) => getSocket().emit("wm:ask", { q }),
    guess: (name) => getSocket().emit("wm:guess", { name }),
    forfeit: () => getSocket().emit("wm:forfeit"),
    rematch: isHost && !peerLeft ? () => getSocket().emit("wm:rematch") : null,
  };
}

/** The house player, on this phone: the same rules (src/lib/whoami.ts), human-like timing. */
export function useWmHouse(nick: string, ref: string): WmMatch {
  const [game, setGame] = useState(0);
  const [hidden, setHidden] = useState(() => wmDeal());
  const [log, setLog] = useState<WmEntry[]>([]);
  const [myTurn, setMyTurn] = useState(true);
  const [turns, setTurns] = useState(0);
  const [hearts, setHearts] = useState({ me: WM_HEARTS, them: WM_HEARTS });
  const [deadline, setDeadline] = useState(() => Date.now() + WM_TURN_MS);
  const [end, setEnd] = useState<{ won: boolean; draw: boolean; reason: NonNullable<WmMatch["endReason"]> } | null>(null);

  const finish = (won: boolean, reason: NonNullable<WmMatch["endReason"]>, draw = false) => {
    setEnd({ won, draw, reason });
    setDeadline(0);
  };
  const next = (wasMine: boolean) => {
    const n = turns + 1;
    setTurns(n);
    if (n >= WM_MAX_TURNS) return finish(false, "turns", true);
    setMyTurn(!wasMine);
    setDeadline(Date.now() + WM_TURN_MS);
  };

  // the clock: out of time passes the turn
  useEffect(() => {
    if (!deadline || end) return;
    const id = setTimeout(() => {
      setLog((l) => [...l, { mine: myTurn, timeout: true }]);
      next(myTurn);
    }, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, end, myTurn]);

  // the house player's turn: think a few seconds, then ask or guess with the shared answers
  useEffect(() => {
    if (myTurn || end || !deadline) return;
    const id = setTimeout(() => {
      const asked = log.flatMap((e) => ("q" in e ? [{ q: e.q, yes: e.yes }] : []));
      const wrong = log.flatMap((e) => ("guess" in e && !e.right ? [e.guess] : []));
      const m = wmHouseMove(asked, wrong);
      if (m.kind === "ask") {
        setLog((l) => [...l, { mine: false, q: m.q, yes: wmAnswer(hidden, m.q) }]);
        return next(false);
      }
      const right = wmIsRight(m.name, hidden);
      setLog((l) => [...l, { mine: false, guess: m.name, right }]);
      if (right) return finish(false, "named");
      if (hearts.them <= 1) {
        setHearts((h) => ({ ...h, them: 0 }));
        return finish(true, "hearts");
      }
      setHearts((h) => ({ ...h, them: h.them - 1 }));
      next(false);
    }, 3_000 + Math.random() * 6_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myTurn, end, deadline]);

  return {
    ready: true,
    myTurn: myTurn && !end,
    deadline,
    turnMs: WM_TURN_MS,
    turns,
    hearts,
    log,
    over: !!end,
    won: !!end?.won,
    draw: !!end?.draw,
    endReason: end?.reason ?? null,
    hidden: end ? hidden.name : null,
    opponent: { nick, ref },
    peerLeft: false,
    key: `wm-house-${ref}-${game}`,
    ask: (q) => {
      if (!myTurn || end) return;
      setLog((l) => [...l, { mine: true, q, yes: wmAnswer(hidden, q) }]);
      next(true);
    },
    guess: (name) => {
      if (!myTurn || end) return;
      const right = wmIsRight(name, hidden);
      setLog((l) => [...l, { mine: true, guess: name, right }]);
      if (right) return finish(true, "named");
      if (hearts.me <= 1) {
        setHearts((h) => ({ ...h, me: 0 }));
        return finish(false, "hearts");
      }
      setHearts((h) => ({ ...h, me: h.me - 1 }));
      next(true);
    },
    forfeit: () => !end && finish(false, "forfeit"),
    rematch: () => {
      setGame((g) => g + 1);
      setHidden(wmDeal());
      setLog([]);
      setTurns(0);
      setHearts({ me: WM_HEARTS, them: WM_HEARTS });
      setEnd(null);
      setMyTurn(game % 2 === 0 ? false : true);
      setDeadline(Date.now() + WM_TURN_MS);
    },
  };
}
