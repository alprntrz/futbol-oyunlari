import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, View } from "react-native";

import type { Grid } from "@/lib/tiki";

import { GameActions } from "~/components/GameActions";
import { SeriesEnd } from "~/components/SeriesEnd";
import { HatTrickBoard } from "~/components/HatTrickBoard";
import { HelpButton } from "~/components/HelpButton";
import { Text } from "~/components/Text";
import { Button, Page, Segmented } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { NEXT_GAME_MS, other, resultOf, SERIES_TARGET, TURN_SECONDS, type Series, type HtCell, type Mark, type Winner } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { dealGrid, useHtLeague } from "~/lib/league";
import { T } from "~/lib/theme";

/** Hat-trick on one phone: X and O take turns. */
export default function HatTrickLocal() {
  const { t } = useI18n();
  const [league] = useHtLeague();
  const [grid, setGrid] = useState<Grid>(() => dealGrid(league));
  const [board, setBoard] = useState<(HtCell | null)[]>(() => Array(9).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [winner, setWinner] = useState<Winner>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [deadline, setDeadline] = useState(() => Date.now() + TURN_SECONDS * 1000);
  const [stealMode, setStealMode] = useState(false);
  const [steals, setSteals] = useState<Record<Mark, number>>({ X: 3, O: 3 });
  const [usedNames, setUsedNames] = useState<string[]>([]);
  // set when the game ended by forfeit: the mark that gave up
  const [forfeited, setForfeited] = useState<Mark | null>(null);
  const [series, setSeries] = useState<Series>({ X: 0, O: 0 });
  const seriesOver = series.X >= SERIES_TARGET || series.O >= SERIES_TARGET;
  // who opens the next game: it alternates through a series
  const [starter, setStarter] = useState<Mark>("X");

  const finish = (w: Winner, gaveUp: Mark | null = null) => {
    setWinner(w);
    if (gaveUp) setSeries((s) => ({ ...s, [other(gaveUp)]: SERIES_TARGET }));
    else if (w === "X" || w === "O") setSeries((s) => ({ ...s, [w]: s[w] + 1 }));
  };

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
    if (board[cell]) setSteals((s) => ({ ...s, [turn]: s[turn] - 1 }));
    setUsedNames((u) => [...u, name]);
    const next = board.slice();
    next[cell] = { mark: turn, name };
    setBoard(next);
    const result = resultOf(next);
    if (result) {
      haptic.success();
      finish(result);
    } else nextTurn(null);
  };

  const offerDraw = () =>
    Alert.alert(t("htLocalDrawAsk"), t("htLocalDrawAskDesc"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("htAccept"), onPress: () => finish("draw") },
    ]);

  const forfeit = () => {
    setForfeited(turn);
    finish(other(turn), turn);
  };

  const skip = () => nextTurn(`${turn}: ${t("htSkipped")}`);

  /** `fresh`: a new series (mode switch, or after one is decided) */
  const newGrid = (fresh = false) => {
    const first = fresh ? "X" : other(starter);
    if (fresh) setSeries({ X: 0, O: 0 });
    setStarter(first);
    setForfeited(null);
    setSteals({ X: 3, O: 3 });
    setUsedNames([]);
    setGrid(dealGrid(league));
    setBoard(Array(9).fill(null));
    setTurn(first);
    setWinner(null);
    setFlash(null);
    setDeadline(Date.now() + TURN_SECONDS * 1000);
    setTimeLeft(TURN_SECONDS);
  };

  // next game of the series after a short look at the result
  useEffect(() => {
    if (!winner || seriesOver) return;
    const id = setTimeout(() => newGrid(), NEXT_GAME_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner, seriesOver]);

  const score = `X ${series.X} – ${series.O} O`;
  const winnerText = forfeited
    ? `${forfeited} ${t("htLocalForfeited")}, ${winner} ${t("htSeriesWonBy")}`
    : seriesOver
      ? `${winner} ${t("htSeriesWonBy")}`
      : winner === "draw"
        ? t("htGameDraw")
        : `${winner} ${t("htTookGame")}`;

  return (
    <Page>
      <Stack.Screen options={{ title: t("htLocal"), headerRight: () => <HelpButton game="tiki" /> }} />
      <View style={{ marginBottom: 12 }}>
        <Segmented
          value={stealMode ? "on" : "off"}
          onChange={(v) => {
            setStealMode(v === "on");
            newGrid(true);
          }}
          options={[
            { value: "off", label: t("htClassic") },
            { value: "on", label: t("htSteals") },
          ]}
        />
        {stealMode && <Text style={[T.caption, { marginTop: 6, marginLeft: 4 }]}>{t("htStealsDesc")}</Text>}
      </View>
      <HatTrickBoard
        steals={stealMode ? steals : null}
        usedNames={usedNames}
        grid={grid}
        board={board}
        turn={turn}
        winner={winner}
        timeLeft={timeLeft}
        labels={{ X: "X", O: "O" }}
        canMove
        status={`${t("ttTurn")}: ${turn}`}
        flash={flash}
        celebrate={seriesOver}
        winnerText={winnerText}
        winnerSub={seriesOver ? score : `${score}, ${t("htNextGame")}`}
        series={series}
        onMove={onMove}
        footer={
          winner && !seriesOver ? null : winner ? (
            <Button title={t("htRematch")} icon="arrow.clockwise" onPress={() => newGrid(true)} style={{ marginTop: 18 }} />
          ) : (
            <GameActions draw={null} onOfferDraw={offerDraw} onForfeit={forfeit} onSkip={skip} canSkip />
          )
        }
      />
      <SeriesEnd
        over={seriesOver}
        won
        countTrophy={false}
        title={`${winner ?? ""} ${t("vcMarkWon")}`}
        mine={winner === "O" ? series.O : series.X}
        theirs={winner === "O" ? series.X : series.O}
        onRematch={() => newGrid(true)}
      />
    </Page>
  );
}
