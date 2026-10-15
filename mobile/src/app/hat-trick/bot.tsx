import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import type { Grid } from "@/lib/tiki";

import { GameActions } from "~/components/GameActions";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { C } from "~/lib/theme";
import { useRecordMatch } from "~/lib/history";
import { SeriesEnd } from "~/components/SeriesEnd";
import { HatTrickBoard } from "~/components/HatTrickBoard";
import { Button, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { COMEBACK_SECONDS, NEXT_GAME_MS, other, resultOf, SERIES_TARGET, TURN_SECONDS, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { botMove, botTakesDraw, botThinkMs } from "~/lib/htBot";
import { useI18n } from "~/lib/i18n";
import { GAME_ICON, useDuelActivity } from "~/lib/liveActivity";
import { dealGrid } from "~/lib/league";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const fakeCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

/**
 * Random-queue fallback when nobody else is searching. Mirrors the online room
 * screen (title, labels, messages, rematch) so the game feels the same either way.
 */
export default function HatTrickHouse() {
  const { t } = useI18n();
  const emotes = useEmotes("ht", false);
  const params = useLocalSearchParams<{ nick?: string; league?: string }>();
  const nick = params.nick || t("opponent");
  const [code] = useState(fakeCode);

  const [me, setMe] = useState<Mark>("X");
  const rival = other(me);
  const [grid, setGrid] = useState<Grid>(() => dealGrid(params.league));
  const [board, setBoard] = useState<(HtCell | null)[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [winner, setWinner] = useState<Winner>(null);
  const [endReason, setEndReason] = useState<"forfeit" | "agreed" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [deadline, setDeadline] = useState(() => Date.now() + TURN_SECONDS * 1000);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [usedNames, setUsedNames] = useState<string[]>([]);
  const [drawSent, setDrawSent] = useState(false);
  // series score: follows the people, marks swap every game
  const [wins, setWins] = useState({ mine: 0, theirs: 0 });
  const seriesOver = wins.mine >= SERIES_TARGET || wins.theirs >= SERIES_TARGET;
  const [startedAt] = useState(() => Date.now());
  useRecordMatch(seriesOver, {
    key: `ht-house-${startedAt}`,
    game: "ht",
    opponent: nick,
    result: wins.mine > wins.theirs ? "win" : "loss",
    score: `${wins.mine}–${wins.theirs}`,
  });
  // comeback bonus, as online: whoever lost the last game gets longer turns
  const [comeback, setComeback] = useState<"me" | "rival" | null>(null);
  const turnSecondsOf = (m: Mark, meNow = me, cb = comeback) => TURN_SECONDS + ((cb === "me" ? meNow : cb === "rival" ? other(meNow) : null) === m ? COMEBACK_SECONDS : 0);

  const nameOf = (m: Mark) => (m === me ? t("you") : nick);

  const nextTurn = () => {
    const next = other(turn);
    setTurn(next);
    setDeadline(Date.now() + turnSecondsOf(next) * 1000);
    setTimeLeft(turnSecondsOf(next));
  };

  const end = (w: Winner, reason: typeof endReason = null) => {
    setWinner(w);
    setEndReason(reason);
    setDrawSent(false);
    if (reason === "forfeit") setWins((s) => (w === me ? { ...s, mine: SERIES_TARGET } : { ...s, theirs: SERIES_TARGET }));
    else if (w === me) {
      setWins((s) => ({ ...s, mine: s.mine + 1 }));
      setComeback("rival");
    } else if (w === rival) {
      setWins((s) => ({ ...s, theirs: s.theirs + 1 }));
      setComeback("me");
    }
  };

  const skip = () => {
    setDrawSent(false);
    setFlash(`${t("you")}: ${t("htSkipped")}`);
    nextTurn();
  };

  const play = (cell: number, name: string | null) => {
    setDrawSent(false);
    if (!name) {
      setFlash(`${nameOf(turn)}: ${t("ttWrong")}`);
      return nextTurn();
    }
    if (turn !== me) haptic.tap();
    setUsedNames((u) => [...u, name]);
    const next = board.slice();
    next[cell] = { mark: turn, name };
    setBoard(next);
    setFlash(null);
    const result = resultOf(next);
    if (result) end(result);
    else nextTurn();
  };

  // Turn clock, for both sides
  useEffect(() => {
    if (winner) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        if (turn === me) haptic.warning();
        setFlash(`${nameOf(turn)}: ${t("ttTimeout")}`);
        setDrawSent(false);
        nextTurn();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, winner, turn]);

  // The opponent takes its time like a person would (and now and then lets the clock run out)
  useEffect(() => {
    // a pending draw offer gets answered first
    if (winner || turn !== rival || drawSent) return;
    const ms = botThinkMs();
    if (ms === null) return;
    const id = setTimeout(() => {
      const move = botMove(grid, board, usedNames, rival);
      play(move.cell, move.name);
    }, ms);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner, deadline, drawSent]);

  // A draw offer gets an answer after a few seconds
  useEffect(() => {
    if (!drawSent || winner) return;
    const id = setTimeout(
      () => {
        if (botTakesDraw(board, rival)) return end("draw", "agreed");
        setDrawSent(false);
        setFlash(t("htDrawDeclined"));
      },
      1200 + Math.random() * 1800
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSent]);

  useEffect(() => {
    if (!winner) return;
    if (winner === me) haptic.success();
    else if (winner !== "draw") haptic.warning();
  }, [winner, me]);

  // Like the online rematch: new grid, marks swap so the other side starts
  const rematch = () => {
    const cb = seriesOver ? null : comeback;
    if (seriesOver) {
      setWins({ mine: 0, theirs: 0 });
      setComeback(null);
    }
    setGrid(dealGrid(params.league));
    setBoard(Array(9).fill(null));
    setUsedNames([]);
    setMe(rival);
    setTurn("X");
    setWinner(null);
    setEndReason(null);
    setFlash(null);
    // marks swap: this phone is `rival` from now on, and X moves first
    setDeadline(Date.now() + turnSecondsOf("X", rival, cb) * 1000);
    setTimeLeft(turnSecondsOf("X", rival, cb));
  };

  // next game of the series after a short look at the result
  useEffect(() => {
    if (!winner || seriesOver) return;
    const id = setTimeout(rematch, NEXT_GAME_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, seriesOver]);

  const iWon = winner === me;
  const score = `${wins.mine} – ${wins.theirs}`;

  // the house player's game looks like any online one, Live Activity included
  useDuelActivity({
    game: t("tikiTakaName"),
    icon: GAME_ICON.ht,
    me,
    opponent: nick,
    turn,
    winner,
    matchOver: seriesOver,
    score: me === "X" ? { X: wins.mine, O: wins.theirs } : { X: wins.theirs, O: wins.mine },
    since: deadline - turnSecondsOf(turn) * 1000,
    deadline,
  });
  const winnerText =
    endReason === "forfeit"
      ? t(iWon ? "htTheyForfeited" : "htYouForfeited")
      : seriesOver
        ? t(iWon ? "htSeriesWon" : "htSeriesLost")
        : winner === "draw"
          ? t(endReason === "agreed" ? "htDrawAgreed" : "htGameDraw")
          : `${nameOf(winner as Mark)} ${t("htTookGame")}`;

  return (
    <Page>
      <Stack.Screen options={{ title: code, headerRight: () => <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" /> }} />
      <HatTrickBoard
        steals={null}
        usedNames={usedNames}
        grid={grid}
        board={board}
        turn={turn}
        winner={winner}
        timeLeft={timeLeft}
        labels={{ X: nameOf("X"), O: nameOf("O") }}
        canMove={turn === me}
        status={turn === me ? t("htYourTurn") : t("htTheirTurn")}
        flash={flash}
        celebrate={iWon && seriesOver}
        winnerText={winnerText}
        winnerSub={seriesOver ? score : `${score}, ${t("htNextGame")}`}
        series={me === "X" ? { X: wins.mine, O: wins.theirs } : { X: wins.theirs, O: wins.mine }}
        turnSeconds={turnSecondsOf(turn)}
        comeback={comeback === "me" ? me : comeback === "rival" ? rival : null}
        onMove={play}
        footer={
          winner && !seriesOver ? null : winner ? (
            <View style={{ marginTop: 18, gap: 10 }}>
              <Button title={t("htRematch")} icon="arrow.clockwise" onPress={rematch} />
              <Button title={t("htNewGame")} kind="secondary" icon="play.fill" onPress={() => router.replace("/hat-trick/rastgele")} />
            </View>
          ) : (
            <GameActions
              draw={drawSent ? "sent" : null}
              onOfferDraw={() => setDrawSent(true)}
              onForfeit={() => end(rival, "forfeit")}
              onSkip={skip}
              canSkip={turn === me}
            />
          )
        }
      />
      <SeriesEnd over={seriesOver} won={wins.mine >= SERIES_TARGET} mine={wins.mine} theirs={wins.theirs} onRematch={rematch} />
      <EmoteLayer e={emotes} top={4} />
    </Page>
  );
}
