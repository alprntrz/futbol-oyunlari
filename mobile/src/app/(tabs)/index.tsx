import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { dailyMatch } from "@/lib/daily";

import { Button, Card, Chip, Icon, Page, Row, SectionLabel } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { loadDayState } from "~/lib/storage";
import { C, R, T } from "~/lib/theme";

type DailyStatus = { kind: "new" } | { kind: "playing"; solved: number } | { kind: "done"; solved: number };

export default function Home() {
  const { t, locale } = useI18n();
  const { match, day } = useMemo(() => dailyMatch(), []);
  const [status, setStatus] = useState<DailyStatus>({ kind: "new" });

  // Refresh the daily card whenever the tab comes back into view
  useFocusEffect(
    useCallback(() => {
      loadDayState(day).then((s) => {
        if (!s || s.matchId !== match.id) return setStatus({ kind: "new" });
        const solved = s.slots.filter((x) => x.solved).length;
        const done = s.gaveUp || s.slots.every((x) => x.solved || x.failed);
        setStatus(done ? { kind: "done", solved } : { kind: "playing", solved });
      });
    }, [day, match.id])
  );

  const today = new Date().toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", weekday: "long" });
  const cta = status.kind === "new" ? t("play") : status.kind === "playing" ? t("continueGame") : t("seeResult");

  return (
    <Page topInset>
      <Text style={T.caption}>{today}</Text>
      <Text style={[T.largeTitle, { marginTop: 2 }]}>{t("appName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("homeSubtitle")}</Text>

      {/* Daily XI hero */}
      <Card style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Icon name="calendar" size={22} color="white" fallback="📅" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>
              {t("missingXI")} · #{day % 1000}
            </Text>
            <Text style={styles.heroTitle}>{t("daily")}</Text>
          </View>
        </View>
        <Text style={styles.heroDesc}>{t("dailyHeroDesc")}</Text>
        <View style={styles.heroStatus}>
          {status.kind === "new" && <Chip label={t("notStarted")} color="white" soft="rgba(255,255,255,0.2)" icon="circle" />}
          {status.kind === "playing" && (
            <Chip label={`${t("inProgress")} · ${status.solved}/11`} color="white" soft="rgba(255,255,255,0.2)" icon="clock" />
          )}
          {status.kind === "done" && (
            <Chip label={`${t("completed")} · ${status.solved}/11`} color="white" soft="rgba(255,255,255,0.2)" icon="checkmark.circle.fill" />
          )}
        </View>
        <Button title={cta} kind="secondary" icon="play.fill" onPress={() => router.push("/eksik-11/gunluk")} style={styles.heroButton} />
      </Card>

      <SectionLabel>{t("missingXI")}</SectionLabel>
      <Card style={styles.list}>
        <Row
          icon="shuffle"
          iconFallback="🎯"
          color={C.green}
          soft={C.greenSoft}
          title={t("practice")}
          subtitle={t("practiceAllDesc")}
          onPress={() => router.push("/eksik-11/pratik")}
        />
        <Row
          icon="tshirt.fill"
          iconFallback="👕"
          color={C.red}
          soft={C.redSoft}
          title={t("byTeam")}
          subtitle={t("byTeamDesc")}
          onPress={() => router.push("/eksik-11/takimlar")}
        />
        <Row
          icon="person.2.fill"
          iconFallback="🏁"
          color={C.violet}
          soft={C.violetSoft}
          title={t("onlineRace")}
          subtitle={t("raceDesc")}
          onPress={() => router.push("/eksik-11/oda")}
          last
        />
      </Card>

      <SectionLabel>{t("otherGames")}</SectionLabel>
      <Card style={styles.list}>
        <Row
          icon="number"
          iconFallback="#"
          color={C.blue}
          soft={C.blueSoft}
          title={t("tikiTakaName")}
          subtitle={t("tikiShort")}
          onPress={() => router.push("/tiki-taka-toe")}
          last
        />
      </Card>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 20, backgroundColor: C.green, padding: 20, borderRadius: R.card + 4 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroBadge: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  heroKicker: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" },
  heroTitle: { color: "white", fontSize: 24, fontWeight: "800", letterSpacing: -0.3 },
  heroDesc: { color: "rgba(255,255,255,0.92)", fontSize: 15, lineHeight: 21, marginTop: 14 },
  heroStatus: { marginTop: 14 },
  heroButton: { marginTop: 16, borderWidth: 0 },
  list: { padding: 0, overflow: "hidden" },
});
