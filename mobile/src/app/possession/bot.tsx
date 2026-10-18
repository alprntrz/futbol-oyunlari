import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import type { GridPlayer } from "@/data/players";
import { XP } from "@/lib/levels";

import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { PlayerMenuButton } from "~/components/PlayerMenu";
import { PossessionBoard } from "~/components/PossessionBoard";
import { Button, Page } from "~/components/ui";
import { houseRef } from "~/lib/blocks";
import { haptic } from "~/lib/haptics";
import { other, type Mark } from "~/lib/hattrick";
import { useRecordMatch } from "~/lib/history";
import { useI18n } from "~/lib/i18n";
import { claimsFor, CLOCK_SECONDS, generateBoard, HEX_COUNT, housePpMove, housePpThinkMs, resultOf, type PpCell } from "~/lib/possession";
import { C } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

const fresh = () => ({ X: CLOCK_SECONDS * 1000, O: CLOCK_SECONDS * 1000 });

/**
 * Random-queue fallback when nobody else is searching: Possession Play against the house player,
 * mirroring the online room (title, labels, clocks, messages, rematch) so it feels the same.
 */
export default function PossessionHouse() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ nick?: string }>();
  const nick = params.nick || t("opponent");
  const [ref] = useState(() => houseRef(`${nick}-${Math.random()}`));
  const emotes = useEmotes("pp", false);

  const [game, setGame] = useState(0);
  const [me, setMe] = useState<Mark>("X");
  const rival = other(me);
  const [board, setBoard] = useState(generateBoard);
  const [owners, setOwners] = useState<(PpCell | null)[]>(() => Array(HEX_COUNT).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  const [bank, setBank] = useState(fresh);
  const [turnStart, setTurnStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [winner, setWinner] = useState<Mark | "draw" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [usedNames, setUsedNames] = useState<string[]>([]);

  const key = `pp-house-${ref}-${game}`;
  useXpAward(!!winner, key, "pp", winner === "draw" ? XP.ppDraw : winner === me ? XP.ppWin : XP.ppLoss);
  const held = (m: Mark) => owners.filter((o) => o?.mark === m).length;
  useRecordMatch(!!winner, { key, game: "pp", opponent: nick, result: winner === "draw" ? "draw" : winner === me ? "win" : "loss", score: `${held(me)}–${held(rival)}` });

  const nameOf = (m: Mark) => (m === me ? t("you") : nick);
  const left = (m: Mark) => (m === turn && !winner ? bank[m] - (now - turnStart) : bank[m]);

  // the chess clocks: running out loses
  useEffect(() => {
    if (winner) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (bank[turn] - (n - turnStart) <= 0) {
        if (turn === me) haptic.warning();
        setBank((b) => ({ ...b, [turn]: 0 }));
        setFlash(`${nameOf(turn)}: ${t("ppTimeout")}`);
        setWinner(other(turn));
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, turnStart, winner]);

  const play = (mark: Mark, hex: number, player: GridPlayer | null) => {
    const n = Date.now();
    setBank((b) => ({ ...b, [mark]: b[mark] - (n - turnStart) }));
    let next = owners;
    if (!player) setFlash(`${nameOf(mark)}: ${t("ttWrong")}`);
    else {
      const claims = claimsFor(hex, (c) => c.test(player), board, owners, mark);
      const stolen = claims.filter((i) => owners[i]).length;
      next = owners.map((o, i) => (claims.includes(i) ? { mark, name: player.name } : o));
      setOwners(next);
      setUsedNames((u) => [...u, player.name]);
      setFlash(`${nameOf(mark)}: ${player.name} +${claims.length} ${t("ppClaimed")}${stolen ? `, ${stolen} ${t("ppStoleShort")}` : ""}`);
    }
    const result = resultOf(next);
    if (result) {
      if (result === me) haptic.success();
      setWinner(result);
      return;
    }
    setTurn(other(mark));
    setTurnStart(n);
  };

  // the house player's turn: think like a person, then move (sometimes a miss)
  useEffect(() => {
    if (turn !== rival || winner) return;
    const id = setTimeout(() => {
      const m = housePpMove(board, owners, usedNames, rival);
      play(rival, m.hex, m.player);
    }, housePpThinkMs());
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, winner]);

  const rematch = () => {
    setGame((g) => g + 1);
    setMe(rival);
    setBoard(generateBoard());
    setOwners(Array(HEX_COUNT).fill(null));
    setTurn("X");
    setBank(fresh());
    setTurnStart(Date.now());
    setWinner(null);
    setFlash(null);
    setUsedNames([]);
  };

  return (
    <Page>
      <Stack.Screen
        options={{
          title: t("ppName"),
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PlayerMenuButton target={{ ref, nick, game: "pp" }} color={C.text} bg="#EEF2EF" />
              <EmoteButton e={emotes} color={C.text} bg="#EEF2EF" />
            </View>
          ),
        }}
      />
      <PossessionBoard
        board={board}
        owners={owners}
        usedNames={usedNames}
        turn={turn}
        clocks={{ X: Math.max(0, Math.ceil(left("X") / 1000)), O: Math.max(0, Math.ceil(left("O") / 1000)) }}
        labels={{ X: nameOf("X"), O: nameOf("O") }}
        canMove={turn === me && !winner}
        winner={winner}
        winnerText={winner === "draw" ? t("ttDraw") : winner === me ? t("htYouWin") : t("htYouLose")}
        status={turn === me ? t("ppYourTurn") : t("htTheirTurn")}
        flash={flash}
        celebrate={winner === me}
        onMove={(hex, player) => turn === me && !winner && play(me, hex, player)}
        footer={
          winner ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Button title={t("htRematch")} icon="arrow.clockwise" onPress={rematch} />
              <Button title={t("htNewGame")} kind="secondary" icon="play.fill" onPress={() => router.replace("/possession/rastgele")} />
            </View>
          ) : null
        }
      />
      <EmoteLayer e={emotes} top={4} />
    </Page>
  );
}
