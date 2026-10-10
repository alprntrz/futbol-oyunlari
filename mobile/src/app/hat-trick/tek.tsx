import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { dayNumber } from "@/lib/daily";
import { generateGrid, seededRandom } from "@/lib/tiki";

import { HatTrickBoard } from "~/components/HatTrickBoard";
import { HelpButton } from "~/components/HelpButton";
import { Text } from "~/components/Text";
import { Card, Icon, Page } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import type { HtCell } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

const LIVES = 3;
const key = (day: number) => `hattrick-daily-${day}`;

interface SoloState {
  board: (HtCell | null)[];
  lives: number;
}

/** Single player: everyone gets the same grid each day; fill all 9 squares with 3 lives. */
export default function HatTrickSolo() {
  const { t } = useI18n();
  const day = dayNumber();
  const grid = useMemo(() => generateGrid(seededRandom(day * 7919 + 17)), [day]);
  const [state, setState] = useState<SoloState | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(key(day))
      .then((raw) => setState(raw ? (JSON.parse(raw) as SoloState) : { board: Array(9).fill(null), lives: LIVES }))
      .catch(() => setState({ board: Array(9).fill(null), lives: LIVES }));
  }, [day]);

  useEffect(() => {
    if (state) AsyncStorage.setItem(key(day), JSON.stringify(state)).catch(() => {});
  }, [state, day]);

  if (!state) return <Page>{null}</Page>;

  const filled = state.board.filter(Boolean).length;
  const done = filled === 9 || state.lives === 0;

  const onMove = (cell: number, name: string | null) => {
    if (!name) {
      haptic.error();
      setState({ ...state, lives: state.lives - 1 });
      return;
    }
    const board = state.board.slice();
    board[cell] = { mark: "X", name };
    if (board.every(Boolean)) haptic.success();
    setState({ ...state, board });
  };

  const header = (
    <Card style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={T.caption}>{t("htSoloStatus")}</Text>
        <Text style={styles.big}>
          {filled}
          <Text style={styles.of}>/9</Text>
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={T.caption}>{t("htLives")}</Text>
        <View style={{ flexDirection: "row", gap: 4, marginTop: 6 }}>
          {Array.from({ length: LIVES }, (_, i) => (
            <Icon key={i} name="heart.fill" size={22} color={i < state.lives ? C.coral : "#D9DFDB"} fallback="♥" />
          ))}
        </View>
      </View>
    </Card>
  );

  return (
    <Page>
      <Stack.Screen options={{ title: `${t("htSolo")} #${day % 1000}`, headerRight: () => <HelpButton game="tiki" /> }} />
      <HatTrickBoard
        grid={grid}
        board={state.board}
        turn="X"
        winner={null}
        timeLeft={0}
        labels={{ X: "", O: "" }}
        canMove={!done}
        status=""
        celebrate={false}
        winnerText=""
        header={header}
        sheetCaption={`${t("htLives")}: ${state.lives}`}
        onMove={onMove}
        footer={
          done ? (
            <Card style={styles.done}>
              <Text style={T.title}>{filled === 9 ? t("htSoloPerfect") : t("htSoloDone")}</Text>
              <Text style={T.body}>
                {filled}/9 · {t("htSoloComeBack")}
              </Text>
            </Card>
          ) : null
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: 16 },
  big: { fontFamily: F.black, fontSize: 40, lineHeight: 44, color: C.text },
  of: { fontFamily: F.display, fontSize: 22, color: C.text3 },
  done: { marginTop: 18, alignItems: "center", gap: 4, paddingVertical: 20 },
});
