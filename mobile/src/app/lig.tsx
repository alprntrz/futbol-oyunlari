import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { Avatar } from "~/components/Avatar";
import { Text } from "~/components/Text";
import { Button, Icon, Page } from "~/components/ui";
import { fetchLeague, markLeagueSeen, useAccount, type League } from "~/lib/account";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

/** colour of each league's shield, bronze → diamond (server-accounts.js LEAGUES) */
export const LEAGUE_COLOR: Record<string, string> = {
  bronze: "#C9864A",
  silver: "#94A3B8",
  gold: "#EAB308",
  sapphire: "#2563EB",
  ruby: "#DC2626",
  emerald: "#059669",
  diamond: "#7C3AED",
};

/**
 * Below this many players a group shows my own progress instead of the table: a near-empty
 * ranking reads as "nobody plays here". Groups only split at 30, so it fills as players come.
 */
const SHOW_TABLE_FROM = 10;

/** "2 days" / "5 hours" until the week ends */
function useLeft(ends: number) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  const h = Math.max(0, Math.floor((ends - now) / 3600000));
  return h >= 24 ? t("lgDays").replace("{n}", String(Math.floor(h / 24))) : t("lgHours").replace("{n}", String(Math.max(1, h)));
}

/**
 * Weekly league: this week's group of up to 30 by XP earned this week. The top
 * of the group moves up a league on Monday, the bottom moves down.
 */
export function LeagueBody() {
  const { t } = useI18n();
  const account = useAccount();
  const [data, setData] = useState<League | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    if (!account) return;
    setFailed(false);
    fetchLeague()
      .then(setData)
      .catch(() => setFailed(true));
  }, [account]);
  useFocusEffect(load);

  // last week's result shows once
  const last = data?.last && !data.last.endsWith(":seen") ? data.last.split(":") : null;
  useEffect(() => {
    if (last) markLeagueSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.last]);

  if (account === null) {
    return (
      <>
        <Shields current={0} leagues={Object.keys(LEAGUE_COLOR)} />
        <Text style={[T.body, { textAlign: "center", marginTop: 16 }]}>{t("lgSignIn")}</Text>
        <Button title={t("lgSignInBtn")} icon="person.crop.circle" onPress={() => router.push("/istatistik")} style={{ marginTop: 16 }} />
      </>
    );
  }

  if (!data) {
    return (
      <>
        {failed ? (
          <>
            <Text style={[T.body, { textAlign: "center", marginTop: 40 }]}>{t("serverUnreachable")}</Text>
            <Button title={t("retry")} kind="secondary" icon="arrow.clockwise" onPress={load} style={{ marginTop: 12 }} />
          </>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} />
        )}
      </>
    );
  }

  const n = data.rows.length;
  const upCount = n >= 2 ? Math.min(data.up, Math.ceil(n / 3)) : 0;
  const downFrom = n >= data.up + data.down ? n - data.down : Infinity;
  const color = LEAGUE_COLOR[data.league] ?? C.green;

  return (
    <View>
        <Shields current={data.tier} leagues={data.leagues} />
        <View style={styles.headRow}>
          <Text style={[styles.leagueName, { color }]}>{t(`lg_${data.league}` as Parameters<typeof t>[0])}</Text>
          <View style={styles.left}>
            <Icon name="clock" size={13} color={C.text2} fallback="⏱" />
            <LeftText ends={data.ends} />
          </View>
        </View>
        <Text style={T.caption}>{t("lgRule").replace("{n}", String(data.up))}</Text>

        {last && (
          <Animated.View entering={FadeIn} style={[styles.result, { backgroundColor: last[0] === "up" ? C.greenSoft : last[0] === "down" ? C.redSoft : "#EEF2EF" }]}>
            <Text style={styles.resultText}>
              {t(last[0] === "up" ? "lgWentUp" : last[0] === "down" ? "lgWentDown" : "lgStayed")
                .replace("{league}", t(`lg_${data.leagues[Number(last[1])]}` as Parameters<typeof t>[0]))
                .replace("{place}", last[2])}
            </Text>
          </Animated.View>
        )}

        {!data.joined ? (
          <View style={styles.empty}>
            <Icon name="flag.checkered" size={30} color={color} fallback="🏁" />
            <Text style={[T.body, { textAlign: "center" }]}>{t("lgNotJoined")}</Text>
          </View>
        ) : n < SHOW_TABLE_FROM ? (
          // a small group: my week, not a short table
          <Animated.View entering={FadeIn} style={styles.filling}>
            <Text style={T.caption}>{t("lgMyWeek")}</Text>
            <Text style={[styles.myXp, { color }]}>{data.rows.find((r) => r.me)?.xp ?? 0} XP</Text>
            <Text style={[T.headline, { textAlign: "center" }]}>{t("lgFilling")}</Text>
            <Text style={[T.body, { textAlign: "center" }]}>
              {data.tier < data.leagues.length - 1
                ? t("lgFillingUp").replace("{league}", t(`lg_${data.leagues[data.tier + 1]}` as Parameters<typeof t>[0]))
                : t("lgFillingTop")}
            </Text>
          </Animated.View>
        ) : (
          <View style={styles.list}>
            {data.rows.map((r, i) => {
              const zone = i < upCount ? "up" : i >= downFrom ? "down" : null;
              return (
                <Animated.View key={`${r.rank}-${r.nick}`} entering={FadeInDown.delay(Math.min(i, 12) * 25).duration(200)}>
                  {i === upCount && upCount > 0 && <ZoneLine kind="up" />}
                  {i === downFrom && <ZoneLine kind="down" />}
                  <View style={[styles.row, r.me && styles.rowMe]}>
                    <Text style={[styles.rank, zone === "up" && { color: C.greenMid }, zone === "down" && { color: C.red }]}>{r.rank}</Text>
                    <Avatar id={r.avatar} size={40} frame={r.frame} me={r.me} />
                    <Text style={[styles.nick, r.me && { color: C.greenDark }]} numberOfLines={1}>
                      {r.me ? `${r.nick} · ${t("you")}` : r.nick}
                    </Text>
                    <Text style={styles.xp}>{r.xp} XP</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>
        )}
    </View>
  );
}

export default function LeagueScreen() {
  const { t } = useI18n();
  return (
    <Page>
      <Stack.Screen options={{ title: t("lgTitle") }} />
      <LeagueBody />
    </Page>
  );
}

function LeftText({ ends }: { ends: number }) {
  return <Text style={styles.leftText}>{useLeft(ends)}</Text>;
}

/** the leagues as a row of shields: passed ones in colour, the current one big, the rest locked */
function Shields({ current, leagues }: { current: number; leagues: string[] }) {
  return (
    <View style={styles.shields}>
      {leagues.map((l, i) => {
        const on = i === current;
        const open = i <= current;
        return (
          <View key={l} style={[styles.shield, on && styles.shieldOn]}>
            <Icon name={open ? "shield.fill" : "lock.shield.fill"} size={on ? 46 : 26} color={open ? LEAGUE_COLOR[l] : "#C9D1CB"} fallback="🛡" />
          </View>
        );
      })}
    </View>
  );
}

function ZoneLine({ kind }: { kind: "up" | "down" }) {
  const { t } = useI18n();
  const c = kind === "up" ? C.greenMid : C.red;
  return (
    <View style={styles.zone}>
      <Icon name={kind === "up" ? "arrow.up" : "arrow.down"} size={13} color={c} fallback={kind === "up" ? "↑" : "↓"} />
      <Text style={[styles.zoneText, { color: c }]}>{t(kind === "up" ? "lgUpZone" : "lgDownZone")}</Text>
      <Icon name={kind === "up" ? "arrow.up" : "arrow.down"} size={13} color={c} fallback={kind === "up" ? "↑" : "↓"} />
    </View>
  );
}

const styles = StyleSheet.create({
  shields: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  shield: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  shieldOn: { width: 64, height: 64 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  leagueName: { fontFamily: F.black, fontSize: 30 },
  left: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EEF2EF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  leftText: { fontWeight: "700", fontSize: 13, color: C.text2 },
  result: { marginTop: 12, borderRadius: 14, padding: 12 },
  resultText: { fontFamily: F.display, fontSize: 17, color: C.text, textAlign: "center" },
  filling: { marginTop: 16, backgroundColor: C.card, borderRadius: 20, padding: 20, alignItems: "center", gap: 8 },
  myXp: { fontFamily: F.black, fontSize: 44, lineHeight: 46 },
  empty: { alignItems: "center", gap: 10, marginTop: 30, paddingHorizontal: 20 },
  list: { marginTop: 14, backgroundColor: C.card, borderRadius: 20, overflow: "hidden", paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 9 },
  rowMe: { backgroundColor: "#ECFDF3" },
  rank: { width: 26, textAlign: "center", fontFamily: F.display, fontSize: 18, color: C.text2 },
  nick: { flex: 1, fontFamily: F.display, fontSize: 18, color: C.text },
  xp: { fontFamily: F.display, fontSize: 16, color: C.text2, fontVariant: ["tabular-nums"] },
  zone: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  zoneText: { fontFamily: F.display, fontSize: 15, letterSpacing: 0.5 },
});
