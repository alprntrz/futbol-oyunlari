import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";

import { cardById } from "@/lib/duel";

import { DuelCardView } from "~/components/duel/DuelCardView";
import { GameHub, HubSetting } from "~/components/GameHub";
import { Text } from "~/components/Text";
import { ROZET } from "~/lib/brand";
import { useDuel } from "~/lib/duel";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

/**
 * Card Duel: without a hand the one button drafts it; with one it finds an
 * opponent. Today's duel and practice below; the hand is a row you can change.
 */
export default function DuelHome() {
  const { t } = useI18n();
  const { hand, theme, ready, daily } = useDuel();

  return (
    <GameHub
      title={t("dzName")}
      image={ROZET.duel}
      bg="#FFE4E6"
      tagline={t("dzShort")}
      status={`${t("dzTheme")}: ${t(`dzTheme_${theme.id}`)}`}
      primary={
        ready
          ? { label: t("playFind"), icon: "play.fill", fallback: "▶", onPress: () => router.push("/duello/rastgele") }
          : { label: t("dzDraft"), icon: "square.stack.fill", fallback: "▤", onPress: () => router.push("/duello/draft") }
      }
      secondary={
        ready
          ? [
              {
                label: daily ? `${daily.mine}–${daily.theirs}` : t("dzDaily"),
                hint: daily ? t("dzDaily") : undefined,
                icon: "calendar",
                fallback: "📅",
                onPress: () => !daily && router.push({ pathname: "/duello/mac", params: { mode: "daily" } }),
              },
              { label: t("htFriend"), icon: "person.2.fill", fallback: "👥", onPress: () => router.push("/duello/oda") },
              { label: t("dzPractice"), icon: "figure.run", fallback: "🏃", onPress: () => router.push({ pathname: "/duello/mac", params: { mode: "practice" } }) },
            ]
          : []
      }
      settings={ready ? <HubSetting label={t("dzHand")} value={t("dzRedraft")} onPress={() => router.push("/duello/draft")} /> : undefined}
      rules={
        <View style={{ gap: 10 }}>
          {(["dzRule1", "dzRule2", "dzRule3", "dzRule4"] as const).map((k, i) => (
            <View key={k} style={styles.rule}>
              <View style={styles.ruleNum}>
                <Text style={styles.ruleNumText}>{i + 1}</Text>
              </View>
              <Text style={[T.body, { flex: 1 }]}>{t(k)}</Text>
            </View>
          ))}
          <Text style={T.caption}>{t("dzDataNote")}</Text>
        </View>
      }
    >
      {ready && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          {hand.map((id) => (
            <DuelCardView key={id} card={cardById(id) ?? null} width={70} />
          ))}
        </ScrollView>
      )}
    </GameHub>
  );
}

const styles = StyleSheet.create({
  rule: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  ruleNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.greenSoft, alignItems: "center", justifyContent: "center" },
  ruleNumText: { fontFamily: F.display, fontSize: 14, color: C.greenDark },
});
