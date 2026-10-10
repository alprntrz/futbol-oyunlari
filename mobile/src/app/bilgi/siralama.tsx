import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LevelBadge } from "~/components/QuizLevel";
import { goBack, NIGHT, NightStatusBar, StadiumHeader } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Icon } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadPlayerId } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { F } from "~/lib/theme";

const HEADER = 110;

interface Standing {
  rank: number;
  nick: string;
  level: number;
  xp: number;
  points: number;
  wins: number;
  me: boolean;
}
type Period = "all" | "week";

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 50%, 45%)`;
}

const MEDAL = ["#FACC15", "#CBD5E1", "#D97706"];

/** Quiz standings across everyone who has played: all time or this week, ranked by XP. */
export default function QuizStandings() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<{ top: Standing[]; me: Standing | null; total: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    loadPlayerId().then((pid) =>
      getSocket()
        .timeout(6000)
        .emit("qz:standings", { pid, period }, (err: Error | null, res?: { ok: boolean; top: Standing[]; me: Standing | null; total: number }) => {
          if (!live) return;
          if (err || !res?.ok) return setError(true);
          setError(false);
          setData(res);
        })
    );
    return () => {
      live = false;
    };
  }, [period]);

  const row = (s: Standing, pinned = false) => (
    <View style={[styles.row, s.me && styles.rowMe, pinned && { marginTop: 0 }]}>
      <View style={[styles.rank, s.rank <= 3 && { backgroundColor: MEDAL[s.rank - 1] }]}>
        <Text allowFontScaling={false} style={[styles.rankText, s.rank <= 3 && { color: "#1C1917" }]}>
          {s.rank}
        </Text>
      </View>
      <View style={[styles.avatar, { backgroundColor: avatarColor(s.nick) }]}>
        <Text allowFontScaling={false} style={styles.avatarText}>
          {(s.nick.trim()[0] ?? "?").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.nick} numberOfLines={1}>
          {s.me ? `${s.nick} (${t("you")})` : s.nick}
        </Text>
        <Text style={styles.meta}>
          {s.wins} {t("qzWins")}, {s.points} {t("qzPoints")}
        </Text>
      </View>
      <LevelBadge level={s.level} size={28} />
      <Text style={styles.xp}>{s.xp}</Text>
    </View>
  );

  const meOutside = data?.me && data.me.rank > data.top.length ? data.me : null;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, contentStyle: { backgroundColor: NIGHT.body } }} />
      <NightStatusBar />
      <StadiumHeader height={HEADER} />
      <Pressable onPress={goBack} style={[styles.back, { top: insets.top + 6 }]} accessibilityRole="button" accessibilityLabel={t("close")} hitSlop={8}>
        <Icon name="chevron.left" size={18} color="white" fallback="‹" />
      </Pressable>

      <View style={{ paddingTop: insets.top + HEADER - 8, paddingHorizontal: 16, gap: 12, flex: 1 }}>
        <Text style={styles.title}>{t("qzStandingsTitle")}</Text>
        <View style={styles.tabs}>
          {(["all", "week"] as Period[]).map((p) => (
            <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.tab, period === p && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: period === p }}>
              <Text style={[styles.tabText, period === p && { color: NIGHT.bodyLow }]}>{p === "all" ? t("qzAllTime") : t("qzThisWeek")}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.headRow}>
          <Text style={styles.headText}>{t("qzPlayers")}</Text>
          <Text style={styles.headText}>XP</Text>
        </View>

        {error ? (
          <Text style={styles.empty}>{t("serverUnreachable")}</Text>
        ) : data && data.top.length === 0 ? (
          <Text style={styles.empty}>{t("qzStandingsEmpty")}</Text>
        ) : (
          <Animated.View key={period} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
            <FlatList
              data={data?.top ?? []}
              keyExtractor={(s) => `${s.rank}-${s.nick}`}
              renderItem={({ item }) => row(item)}
              contentContainerStyle={{ gap: 8, paddingBottom: insets.bottom + (meOutside ? 90 : 24) }}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        )}
      </View>

      {/* you, when you're not in the top 50 */}
      {meOutside && <View style={[styles.pinned, { paddingBottom: insets.bottom + 10 }]}>{row(meOutside, true)}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT.body },
  back: { position: "absolute", left: 12, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.black, fontSize: 32, lineHeight: 36, color: "white" },
  tabs: { flexDirection: "row", backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 999, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 999 },
  tabOn: { backgroundColor: "white" },
  tabText: { fontSize: 15, fontWeight: "800", color: "rgba(255,255,255,0.8)" },
  headRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 },
  headText: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  rowMe: { backgroundColor: "rgba(34,211,238,0.18)", borderWidth: 1.5, borderColor: NIGHT.accent },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)" },
  rankText: { fontFamily: F.display, fontSize: 15, color: "white" },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "white" },
  avatarText: { color: "white", fontWeight: "800", fontSize: 14 },
  nick: { fontSize: 16, fontWeight: "800", color: "white" },
  meta: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.65)", marginTop: 1 },
  xp: { fontFamily: F.black, fontSize: 20, color: "white", minWidth: 48, textAlign: "right" },
  empty: { fontSize: 15, color: "rgba(255,255,255,0.75)", textAlign: "center", marginTop: 30 },
  pinned: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: NIGHT.bodyLow },
});
