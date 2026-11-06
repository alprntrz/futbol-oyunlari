import { useEffect, useState } from "react";

import {
  SPOT_PICK_MS,
  SPOT_REVEAL_MS,
  spotHousePick,
  spotHouseThinkMs,
  spotIsGoal,
  spotKicker,
  spotOther,
  spotResult,
  spotTally,
  type SpotDir,
  type SpotKick,
  type SpotMark,
} from "@/lib/spot";

import { getNick } from "./raceSession";
import { getSocket } from "./socket";

/**
 * One The Spot match as the screen sees it, whoever runs it: the server (`sp:*`, the rival's pick
 * stays there until both are in) or this phone (the house player). Same shape either way.
 */
export interface SpotMatch {
  ready: boolean;
  mark: SpotMark;
  phase: "pick" | "reveal";
  /** my pick for this kick */
  mine: SpotDir | null;
  deadline: number;
  kicks: SpotKick[];
  score: { me: number; them: number };
  over: boolean;
  won: boolean;
  draw: boolean;
  endReason: "full" | "forfeit" | "left" | null;
  opponent: { nick: string; ref: string | null } | null;
  peerLeft: boolean;
  key: string;
  pick: (dir: SpotDir) => void;
  forfeit: () => void;
  /** null: nothing to do (already asked, or the rival left) */
  rematch: (() => void) | null;
  /** the rival is waiting for my yes */
  rivalWantsAgain: boolean;
  /** I asked, the rival hasn't answered */
  waitingAgain: boolean;
}

interface ServerRoom {
  code: string;
  started: boolean;
  kicks: SpotKick[];
  phase: "pick" | "reveal";
  remainingMs: number;
  winner: SpotMark | "draw" | null;
  endReason: SpotMatch["endReason"];
  again: SpotMark[];
  players: { id: string; ref?: string | null; nick: string; mark: SpotMark }[];
}

/** Online: the server's room (`sp:update`); this phone only sends its pick. */
export function useSpotOnline(code: string): SpotMatch & { room: ServerRoom | null; error: string | null; myId: string } {
  const [room, setRoom] = useState<ServerRoom | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [peerLeft, setPeerLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");
  const [games, setGames] = useState(0);
  const [picked, setPicked] = useState<{ at: string; dir: SpotDir } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: ServerRoom) => {
      setRoom((prev) => {
        if (prev?.winner && !r.winner) setGames((g) => g + 1);
        return r;
      });
      setDeadline(r.remainingMs ? Date.now() + r.remainingMs : 0);
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
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("sp:update", onUpdate);
    socket.on("sp:peer-left", onLeft);
    socket.on("connect", onConnect);
    socket.emit("sp:join", { code, nick: getNick() }, (res: { ok: boolean; error?: string; room?: ServerRoom }) => {
      if (res.ok && res.room) apply(res.room);
      else setError(res.error === "full" ? "full" : "not_found");
    });
    return () => {
      socket.off("sp:update", onUpdate);
      socket.off("sp:peer-left", onLeft);
      socket.off("connect", onConnect);
      socket.emit("sp:leave", { code });
    };
  }, [code]);

  const me = room?.players.find((p) => p.id === myId);
  const them = room?.players.find((p) => p.id !== myId);
  const mark: SpotMark = me?.mark ?? "X";
  const kicks = room?.kicks ?? [];
  const tally = spotTally(kicks);
  const kickId = `${games}-${kicks.length}`;
  const again = room?.again ?? [];
  const asked = again.includes(mark);
  return {
    room,
    error,
    myId,
    ready: !!room?.started,
    mark,
    phase: room?.phase ?? "pick",
    mine: picked?.at === kickId ? picked.dir : null,
    deadline,
    kicks,
    score: { me: tally[mark], them: tally[spotOther(mark)] },
    over: !!room?.winner,
    won: room?.winner === mark,
    draw: room?.winner === "draw",
    endReason: room?.endReason ?? null,
    opponent: them ? { nick: them.nick, ref: them.ref ?? null } : null,
    peerLeft,
    key: `sp-${code}-${games}`,
    pick: (dir) => {
      setPicked({ at: kickId, dir });
      getSocket().emit("sp:pick", { dir });
    },
    forfeit: () => getSocket().emit("sp:forfeit"),
    rematch: !peerLeft && !asked ? () => getSocket().emit("sp:rematch") : null,
    rivalWantsAgain: !peerLeft && !asked && again.length > 0,
    waitingAgain: !peerLeft && asked,
  };
}

/** The house player, on this phone: the same rules (src/lib/spot.ts), human-like timing. */
export function useSpotHouse(nick: string, ref: string): SpotMatch {
  const [game, setGame] = useState(0);
  const [mark, setMark] = useState<SpotMark>("X");
  const [kicks, setKicks] = useState<SpotKick[]>([]);
  const [phase, setPhase] = useState<"pick" | "reveal">("pick");
  const [mine, setMine] = useState<SpotDir | null>(null);
  const [theirs, setTheirs] = useState<SpotDir | null>(null);
  const [deadline, setDeadline] = useState(() => Date.now() + SPOT_PICK_MS);
  const [forfeited, setForfeited] = useState(false);

  const rival = spotOther(mark);
  const result = phase === "pick" ? spotResult(kicks) : null;
  const winner = forfeited ? rival : result;
  const over = !!winner;

  // the house player picks after a moment's thought
  useEffect(() => {
    if (phase !== "pick" || over) return;
    const id = setTimeout(() => setTheirs(spotHousePick(kicks, rival)), spotHouseThinkMs());
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kicks.length, phase, over, game]);

  // both in, or the clock ran out: the kick plays out
  useEffect(() => {
    if (phase !== "pick" || over) return;
    const take = () => {
      const kicker = spotKicker(kicks);
      const shot = kicker === mark ? mine : theirs;
      const dive = kicker === mark ? theirs : mine;
      setKicks([...kicks, { kicker, shot, dive, goal: spotIsGoal(shot, dive) }]);
      setPhase("reveal");
    };
    if (mine && theirs) return take();
    const id = setTimeout(take, Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, theirs, phase, over, deadline]);

  useEffect(() => {
    if (phase !== "reveal" || forfeited) return;
    const id = setTimeout(() => {
      setMine(null);
      setTheirs(null);
      setDeadline(Date.now() + SPOT_PICK_MS);
      setPhase("pick");
    }, SPOT_REVEAL_MS);
    return () => clearTimeout(id);
  }, [phase, forfeited]);

  const tally = spotTally(kicks);
  return {
    ready: true,
    mark,
    phase,
    mine,
    deadline,
    kicks,
    score: { me: tally[mark], them: tally[rival] },
    over,
    won: winner === mark,
    draw: winner === "draw",
    endReason: forfeited ? "forfeit" : over ? "full" : null,
    opponent: { nick, ref },
    peerLeft: false,
    key: `sp-house-${ref}-${game}`,
    pick: (dir) => {
      if (phase === "pick" && !mine && !over) setMine(dir);
    },
    forfeit: () => setForfeited(true),
    rematch: () => {
      setGame((g) => g + 1);
      setMark(rival);
      setKicks([]);
      setPhase("pick");
      setMine(null);
      setTheirs(null);
      setForfeited(false);
      setDeadline(Date.now() + SPOT_PICK_MS);
    },
    rivalWantsAgain: false,
    waitingAgain: false,
  };
}
