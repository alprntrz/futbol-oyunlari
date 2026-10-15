import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import { Avatar } from "~/components/Avatar";
import { softIn } from "~/components/motion";
import { LevelBadge } from "~/components/QuizLevel";
import { Text } from "~/components/Text";
import { Card, Page, Segmented } from "~/components/ui";
import { fetchLeaderboard, useAccount, type Board, type BoardRow } from "~/lib/account";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

const MEDAL = ["#FACC15", "#CBD5E1", "#D97706"];

/** Overall (XP) and per-game skill ratings across all signed-in players. */
export function LeaderboardsBody() {
  const { t } = useI18n();
  const account = useAccount();
  const [board, setBoard] = useState<Board>("xp");
  const [data, setData] = useState<{ top: BoardRow[]; me: BoardRow | null } | null>(null);
  const [error, setError] = useState(false);

  // a new board starts from the spinner (adjusted during render, not in the effect)
  const [shown, setShown] = useState(board);
  if (shown !== board) {
    setShown(board);
    setData(null);
    setError(false);
  }

  useEffect(() => {
    let live = true;
    fetchLeaderboard(board)
      .then((d) => live && setData(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [board]);

  const meOffList = data?.me && !data.top.some((r) => r.me) ? data.me : null;

  return (
    <>
      <Segmented
        value={board}
        onChange={setBoard}
        options={[
          { value: "xp", label: t("boardXp") },
          { value: "ht", label: t("boardHt") },
          { value: "qz", label: t("boardQz") },
          { value: "pp", label: t("boardPp") },
          { value: "dz", label: t("boardDz") },
        ]}
      />
      <Text style={[T.caption, { marginTop: 10 }]}>{board === "xp" ? t("boardXpNote") : t("boardRatingNote")}</Text>
      {account === null && <Text style={[T.caption, { marginTop: 6, color: C.greenDark, fontWeight: "700" }]}>{t("leaderboardSignIn")}</Text>}
      {account && board !== "xp" && data && !data.me && (
        <Text style={[T.caption, { marginTop: 6, color: C.greenDark, fontWeight: "700" }]}>{t("leaderboardPlayFirst")}</Text>
      )}

      {error ? (
        <Text style={[T.body, styles.empty]}>{t("leaderboardError")}</Text>
      ) : !data ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : data.top.length === 0 ? (
        <Text style={[T.body, styles.empty]}>{t("leaderboardEmpty")}</Text>
      ) : (
        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          {data.top.map((r, i) => (
            <Animated.View key={`${board}-${r.rank}`} entering={softIn(i, 30)}>
              <Row row={r} board={board} divider={i > 0} />
            </Animated.View>
          ))}
        </Card>
      )}

      {meOffList && (
        <>
          <Text style={[T.caption, { marginTop: 16, marginBottom: 6, fontWeight: "700" }]}>{t("yourRank")}</Text>
          <Card style={{ paddingVertical: 4 }}>
            <Row row={meOffList} board={board} divider={false} />
          </Card>
        </>
      )}
    </>
  );
}

export default function Leaderboards() {
  const { t } = useI18n();
  return (
    <Page>
      <Stack.Screen options={{ title: t("leaderboards") }} />
      <LeaderboardsBody />
    </Page>
  );
}

function Row({ row, board, divider }: { row: BoardRow; board: Board; divider: boolean }) {
  const { t } = useI18n();
  return (
    <View style={[styles.row, divider && styles.divider, row.me && styles.me]}>
      <View style={[styles.rank, row.rank <= 3 && { backgroundColor: MEDAL[row.rank - 1] }]}>
        <Text style={[styles.rankText, row.rank <= 3 && { color: "#3B2A05" }]}>{row.rank}</Text>
      </View>
      <Avatar id={row.avatar} nick={row.nick} size={38} frame={row.frame} />
      <View style={{ flex: 1 }}>
        <Text style={T.headline} numberOfLines={1}>
          {row.nick}
        </Text>
        {board !== "xp" && row.games !== undefined && <Text style={T.caption}>{(row.games === 1 ? t("gamesOne") : t("gamesN").replace("{n}", String(row.games)))}</Text>}
      </View>
      {board === "xp" && <LevelBadge level={row.level} size={28} />}
      <Text style={styles.value}>{board === "xp" ? `${row.value} XP` : row.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", marginTop: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 4 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  me: { backgroundColor: C.greenSoft, borderRadius: 12 },
  rank: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#EEF2EF", alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: F.display, fontSize: 16, color: C.text2 },
  value: { fontFamily: F.display, fontSize: 18, color: C.greenDark, minWidth: 56, textAlign: "right" },
});
