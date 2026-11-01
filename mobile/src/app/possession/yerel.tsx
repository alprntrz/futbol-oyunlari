import { Stack } from "expo-router";
import { useEffect, useState } from "react";

import type { GridPlayer } from "@/data/players";
import { XP } from "@/lib/levels";

import { PossessionBoard } from "~/components/PossessionBoard";
import { Button, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { other, type Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { claimsFor, CLOCK_SECONDS, generateBoard, HEX_COUNT, resultOf, type PpCell } from "~/lib/possession";
import { useXpAward } from "~/lib/xp";

const fresh = () => ({ X: CLOCK_SECONDS * 1000, O: CLOCK_SECONDS * 1000 });

/** Possession Play on one phone: X and O share the board, each with a chess clock. */
export default function PossessionLocal() {
  const { t } = useI18n();
  const [board, setBoard] = useState(generateBoard);
  const [owners, setOwners] = useState<(PpCell | null)[]>(() => Array(HEX_COUNT).fill(null));
  const [turn, setTurn] = useState<Mark>("X");
  // remaining ms per player, counted up to the start of the current turn
  const [bank, setBank] = useState(fresh);
  const [turnStart, setTurnStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [winner, setWinner] = useState<Mark | "draw" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [usedNames, setUsedNames] = useState<string[]>([]);
  // both players share this phone: a small thank-you per finished board
  useXpAward(!!winner, `pp-local-${board.slice(0, 4).map((c) => c.id).join(",")}`, "pp", XP.sameScreen);

  const left = (m: Mark) => (m === turn && !winner ? bank[m] - (now - turnStart) : bank[m]);

  useEffect(() => {
    if (winner) return;
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (bank[turn] - (n - turnStart) <= 0) {
        haptic.warning();
        setBank((b) => ({ ...b, [turn]: 0 }));
        setFlash(`${turn}: ${t("ppTimeout")}`);
        setWinner(other(turn));
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, turnStart, winner]);

  const endTurn = (message: string | null, nextOwners = owners) => {
    const n = Date.now();
    setBank((b) => ({ ...b, [turn]: b[turn] - (n - turnStart) }));
    setFlash(message);
    const result = resultOf(nextOwners);
    if (result) {
      haptic.success();
      setWinner(result);
      return;
    }
    setTurn(other(turn));
    setTurnStart(n);
  };

  const onMove = (hex: number, player: GridPlayer | null) => {
    if (!player) return endTurn(`${turn}: ${t("ttWrong")}`);
    const claims = claimsFor(hex, (c) => c.test(player), board, owners, turn);
    const stolen = claims.filter((i) => owners[i]).length;
    setUsedNames((u) => [...u, player.name]);
    const next = owners.map((o, i) => (claims.includes(i) ? { mark: turn, name: player.name } : o));
    setOwners(next);
    endTurn(`${player.name}: +${claims.length} ${t("ppClaimed")}${stolen ? `, ${stolen} ${t("ppStoleShort")}` : ""}`, next);
  };

  const restart = () => {
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
      <Stack.Screen options={{ title: t("htSame") }} />
      <PossessionBoard
        board={board}
        owners={owners}
        usedNames={usedNames}
        turn={turn}
        clocks={{ X: Math.ceil(left("X") / 1000), O: Math.ceil(left("O") / 1000) }}
        labels={{ X: "X", O: "O" }}
        canMove
        winner={winner}
        winnerText={winner === "draw" ? t("ttDraw") : `${winner} ${t("ttWins")}`}
        status={t("ttTurn")}
        flash={flash}
        celebrate
        onMove={onMove}
        footer={<Button title={t("ttNewGrid")} kind={winner ? "primary" : "secondary"} icon="arrow.clockwise" onPress={restart} style={{ marginTop: 16 }} />}
      />
    </Page>
  );
}
