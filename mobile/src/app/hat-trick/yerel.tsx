import { Stack } from "expo-router";
import { useEffect, useState } from "react";

import { generateGrid, type Grid } from "@/lib/tiki";

import { HatTrickBoard } from "~/components/HatTrickBoard";
import { HelpButton } from "~/components/HelpButton";
import { Button, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { other, resultOf, TURN_SECONDS, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";

/** Hat-trick on one phone: X and O take turns. */
export default function HatTrickLocal() {
  const { t } = useI18n();
  const [grid, setGrid] = useState<Grid>(generateGrid);
  const [board, setBoard] = useState<(HtCell | null)[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [winner, setWinner] = useState<Winner>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [deadline, setDeadline] = useState(() => Date.now() + TURN_SECONDS * 1000);

  const nextTurn = (message: string | null) => {
    setFlash(message);
    setTurn(other);
    setDeadline(Date.now() + TURN_SECONDS * 1000);
    setTimeLeft(TURN_SECONDS);
  };

  // Per-turn countdown from a deadline; at zero the turn passes
  useEffect(() => {
    if (winner) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        haptic.warning();
        nextTurn(`${turn}: ${t("ttTimeout")}`);
      }
    }, 250);
    return () => clearInterval(id);
    // nextTurn/t only change with turn/locale, which restart the interval anyway
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, winner, turn]);

  const onMove = (cell: number, name: string | null) => {
    if (!name) return nextTurn(`${turn}: ${t("ttWrong")}`);
    const next = board.slice();
    next[cell] = { mark: turn, name };
    setBoard(next);
    const result = resultOf(next);
    if (result) {
      haptic.success();
      setWinner(result);
    } else nextTurn(null);
  };

  const newGrid = () => {
    setGrid(generateGrid());
    setBoard(Array(9).fill(null));
    setTurn("X");
    setWinner(null);
    setFlash(null);
    setDeadline(Date.now() + TURN_SECONDS * 1000);
    setTimeLeft(TURN_SECONDS);
  };

  return (
    <Page>
      <Stack.Screen options={{ title: t("htLocal"), headerRight: () => <HelpButton game="tiki" /> }} />
      <HatTrickBoard
        grid={grid}
        board={board}
        turn={turn}
        winner={winner}
        timeLeft={timeLeft}
        labels={{ X: "X", O: "O" }}
        canMove
        status={`${t("ttTurn")}: ${turn} · ${t("ttPick")}`}
        flash={flash}
        celebrate
        winnerText={winner === "draw" ? t("ttDraw") : `${winner} ${t("ttWins")}`}
        onMove={onMove}
        footer={
          <Button title={t("ttNewGrid")} kind={winner ? "primary" : "secondary"} icon="arrow.clockwise" onPress={newGrid} style={{ marginTop: 18 }} />
        }
      />
    </Page>
  );
}
