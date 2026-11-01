import { useEffect, useRef, useState } from "react";

import { dealRondoPairs, houseRondoPairAnswer, houseRondoPairThinkMs, judgeRondoPair, rondoPairAnswers, rondoPairClubs, RONDO_PAIR_HAND_MS, RONDO_PAIR_MISS_MS, RONDO_PAIR_TARGET } from "@/lib/rondo";

import type { RondoMatch, RondoRoundEnd } from "./rondoMatch";

const HAND_GAP_MS = 4_500;
/** dealt on top of the hands a match needs, for hands nobody wins */
const SPARE_PAIRS = 6;

/**
 * The two-club duel against the house player, on this phone: the same rules as the server
 * (src/lib/rondo.ts), a shared clock a hand, and a house player who races a famous answer
 * in after a human-like think, blanking now and then so you can win.
 */
export function useRondoPairHouse(nick: string, ref: string, target = RONDO_PAIR_TARGET): RondoMatch {
  const [game, setGame] = useState(0);
  const [pairs, setPairs] = useState(() => dealRondoPairs(undefined, target * 2 - 1 + SPARE_PAIRS));
  const [round, setRound] = useState(0);
  const [score, setScore] = useState({ me: 0, them: 0 });
  const [names, setNames] = useState<RondoMatch["names"]>([]);
  const [deadline, setDeadline] = useState(() => Date.now() + RONDO_PAIR_HAND_MS);
  const [roundEnd, setRoundEnd] = useState<RondoRoundEnd | null>(null);
  const [wrong, setWrong] = useState<RondoMatch["wrong"]>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const over = score.me >= target || score.them >= target;
  const pairId = pairs[round];
  const endedRef = useRef(false);

  const endHand = (won: boolean | null, name?: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setRoundEnd({ won, reason: won === null ? "timeout" : "answer", name, answers: rondoPairAnswers(pairId) });
    setDeadline(0);
    if (won !== null) setScore((s) => (won ? { ...s, me: s.me + 1 } : { ...s, them: s.them + 1 }));
  };

  // the shared clock: nobody in time, no hand
  useEffect(() => {
    if (!deadline || roundEnd || over) return;
    const id = setTimeout(() => endHand(null), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, roundEnd, over]);

  // the house player thinks, then races an answer in (or blanks)
  useEffect(() => {
    if (roundEnd || over || !deadline) return;
    const think = houseRondoPairThinkMs();
    const id = setTimeout(() => {
      const name = houseRondoPairAnswer(pairId);
      if (!name || endedRef.current) return;
      setNames([{ mine: false, name }]);
      endHand(false, name);
    }, think);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, roundEnd, over, pairId]);

  // the lock after a miss lifts by itself
  const lockLeft = Math.max(0, lockedUntil - now);
  useEffect(() => {
    if (lockLeft <= 0) return;
    const id = setTimeout(() => setNow(Date.now()), lockLeft);
    return () => clearTimeout(id);
  }, [lockLeft]);

  // the next pair after a pause (deal more if the spares ran out)
  useEffect(() => {
    if (!roundEnd || over) return;
    const id = setTimeout(() => {
      const next = round + 1;
      if (next >= pairs.length) setPairs((p) => [...p, ...dealRondoPairs(undefined, SPARE_PAIRS).filter((id) => !p.includes(id))]);
      setRound(next);
      setNames([]);
      setRoundEnd(null);
      setLockedUntil(0);
      endedRef.current = false;
      setDeadline(Date.now() + RONDO_PAIR_HAND_MS);
    }, HAND_GAP_MS);
    return () => clearTimeout(id);
  }, [roundEnd, over, round, pairs.length]);

  return {
    ready: true,
    mode: "pair",
    target,
    maxRounds: target * 2 - 1,
    club: null,
    pair: pairId ? rondoPairClubs(pairId) : null,
    round,
    score,
    myTurn: !roundEnd && !over && lockLeft <= 0,
    names,
    deadline,
    turnMs: RONDO_PAIR_HAND_MS,
    roundEnd,
    over,
    won: score.me >= target,
    opponent: { nick, ref },
    peerLeft: false,
    wrong,
    key: `rd-pair-house-${ref}-${game}`,
    timeJokers: 0,
    useTime: () => {},
    answer: (guess) => {
      if (roundEnd || over || lockLeft > 0) return;
      const v = judgeRondoPair(guess, pairId, []);
      if (!v.ok) {
        setLockedUntil(Date.now() + RONDO_PAIR_MISS_MS);
        setNow(Date.now());
        return setWrong((p) => ({ id: (p?.id ?? 0) + 1, guess, reason: v.reason }));
      }
      setNames([{ mine: true, name: v.player.name }]);
      endHand(true, v.player.name);
    },
    forfeit: () => {
      if (over) return;
      setScore((s) => ({ ...s, them: target }));
      setRoundEnd({ won: false, reason: "forfeit" });
      setDeadline(0);
    },
    rematch: () => {
      setGame((g) => g + 1);
      setPairs(dealRondoPairs(undefined, target * 2 - 1 + SPARE_PAIRS));
      setRound(0);
      setScore({ me: 0, them: 0 });
      setNames([]);
      setRoundEnd(null);
      setWrong(null);
      setLockedUntil(0);
      endedRef.current = false;
      setDeadline(Date.now() + RONDO_PAIR_HAND_MS);
    },
  };
}
