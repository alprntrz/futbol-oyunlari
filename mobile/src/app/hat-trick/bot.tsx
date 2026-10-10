import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { generateGrid, type Grid } from "@/lib/tiki";

import { HatTrickBoard } from "~/components/HatTrickBoard";
import { HelpButton } from "~/components/HelpButton";
import { MatchIntro } from "~/components/MatchIntro";
import { Button, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { other, resultOf, TURN_SECONDS, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { botMove } from "~/lib/htBot";
import { useI18n } from "~/lib/i18n";

const ME: Mark = "X";
const BOT: Mark = "O";

/** Hat-trick against a bot, offered when the random queue finds nobody. Always labelled as a bot. */
export default function HatTrickBot() {
  const { t } = useI18n();
  const [intro, setIntro] = useState(true);
  const [grid, setGrid] = useState<Grid>(generateGrid);
  const [board, setBoard] = useState<(HtCell | null)[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>(ME);
  const [winner, setWinner] = useState<Winner>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [deadline, setDeadline] = useState(0);
  const [usedNames, setUsedNames] = useState<string[]>([]);

  const restartClock = () => {
    setDeadline(Date.now() + TURN_SECONDS * 1000);
    setTimeLeft(TURN_SECONDS);
  };

  const play = (cell: number, name: string | null) => {
    const who = turn === ME ? t("you") : t("htBotTag");
    if (!name) {
      setFlash(`${who}: ${t("ttWrong")}`);
      setTurn(other);
      return restartClock();
    }
    setUsedNames((u) => [...u, name]);
    const next = board.slice();
    next[cell] = { mark: turn, name };
    setBoard(next);
    setFlash(null);
    const result = resultOf(next);
    if (result) {
      if (result === ME) haptic.success();
      else haptic.warning();
      return setWinner(result);
    }
    if (turn === ME) haptic.tap();
    setTurn(other);
    restartClock();
  };

  // Turn clock (only the human can run out of time; the bot answers well inside it)
  useEffect(() => {
    if (intro || winner) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && turn === ME) {
        haptic.warning();
        setFlash(`${t("you")}: ${t("ttTimeout")}`);
        setTurn(BOT);
        restartClock();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, winner, turn, intro]);

  // The bot "thinks" for a few seconds, then plays
  useEffect(() => {
    if (intro || winner || turn !== BOT) return;
    const id = setTimeout(
      () => {
        const move = botMove(grid, board, usedNames, BOT);
        play(move.cell, move.name);
      },
      2500 + Math.random() * 4000
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, intro, winner]);

  const rematch = () => {
    setGrid(generateGrid());
    setBoard(Array(9).fill(null));
    setUsedNames([]);
    setTurn(ME);
    setWinner(null);
    setFlash(null);
    restartClock();
  };

  if (intro) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("htRandom") }} />
        <MatchIntro
          me={{ name: t("you"), mark: ME }}
          opponent={{ name: t("htBotTag"), mark: BOT, bot: true }}
          onDone={() => {
            setIntro(false);
            restartClock();
          }}
        />
      </Page>
    );
  }

  return (
    <Page>
      <Stack.Screen options={{ title: t("htBotTitle"), headerRight: () => <HelpButton game="tiki" /> }} />
      <HatTrickBoard
        usedNames={usedNames}
        grid={grid}
        board={board}
        turn={turn}
        winner={winner}
        timeLeft={timeLeft}
        labels={{ X: t("you"), O: t("htBotTag") }}
        canMove={turn === ME}
        status={turn === ME ? t("htYourTurn") : t("htBotThinking")}
        flash={flash}
        celebrate={winner === ME}
        winnerText={winner === "draw" ? t("ttDraw") : winner === ME ? t("htYouWin") : t("htYouLose")}
        onMove={play}
        footer={
          winner ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <Button title={t("htRematch")} icon="arrow.clockwise" onPress={rematch} style={{ flex: 1 }} />
              <Button title={t("htFindPlayer")} kind="secondary" icon="person.2.fill" onPress={() => router.replace("/hat-trick/rastgele")} style={{ flex: 1 }} />
            </View>
          ) : null
        }
      />
    </Page>
  );
}
