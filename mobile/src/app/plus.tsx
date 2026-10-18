import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { PLUS_FOREVER, PLUS_PERKS, type PlusPerk } from "@/lib/plus";

import { Text } from "~/components/Text";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { PRIVACY_URL } from "~/lib/links";
import { loadPlusOffers, purchasePlus, purchasesAvailable, restorePlus, simulatePlus, usePlus, type PlusOffer } from "~/lib/plus";
import { play } from "~/lib/sound";
import { C, F, R, shadow, T } from "~/lib/theme";
import { loadPracticeToday } from "~/lib/xp";

type IconName = Parameters<typeof Icon>[0]["name"];
const PERK_ICON: Record<PlusPerk, { icon: IconName; color: string }> = {
  noAds: { icon: "xmark.circle.fill", color: C.coral },
  noCap: { icon: "infinity", color: C.amber },
  archive: { icon: "archivebox.fill", color: C.blue },
  streak: { icon: "flame.fill", color: "#F97316" },
  frame: { icon: "crown.fill", color: "#CA8A04" },
};

const TERMS_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
const MANAGE_URL = Platform.select({ ios: "https://apps.apple.com/account/subscriptions", android: "https://play.google.com/store/account/subscriptions" })!;

/**
 * The paywall. One subscription, three ways to pay (yearly picked by default), what it gives and,
 * just as clearly, what it doesn't: nothing inside a match. Store prices come in the player's own
 * currency through RevenueCat; the small print says how renewal and cancelling work (App Store 3.1.2).
 */
export default function PlusScreen() {
  const { t, locale } = useI18n();
  const plus = usePlus();
  const available = purchasesAvailable();
  // null = still asking the store; [] = nothing to buy here
  const [offers, setOffers] = useState<PlusOffer[] | null>(available ? null : []);
  const [pick, setPick] = useState<PlusOffer["plan"]>("yearly");
  const [busy, setBusy] = useState(false);
  const [practice, setPractice] = useState<{ used: number; cap: number } | null>(null);

  useEffect(() => {
    if (available) loadPlusOffers().then(setOffers);
    loadPracticeToday().then(setPractice);
  }, [available]);

  const chosen = offers?.find((o) => o.plan === pick) ?? offers?.[0];
  const buy = async () => {
    if (!chosen) return;
    setBusy(true);
    const res = await purchasePlus(chosen);
    setBusy(false);
    if (res === "ok") {
      haptic.success();
      play("levelup");
      Alert.alert(t("plusThanks"), t("plusThanksBody"), [{ text: t("vcContinue"), onPress: () => router.back() }]);
    } else if (res === "error") Alert.alert(t("plusFailed"));
  };
  const restore = async () => {
    setBusy(true);
    const ok = await restorePlus();
    setBusy(false);
    Alert.alert(ok ? t("plusRestored") : t("plusRestoreNone"));
  };

  const until = plus.until && plus.until < PLUS_FOREVER ? new Date(plus.until).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <Page>
      <Stack.Screen options={{ title: t("plusName") }} />

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.crown}>
          <Icon name="crown.fill" size={40} color="#3B2A05" />
        </View>
        <Text style={styles.heroTitle}>{t("plusName")}</Text>
        <Text style={styles.heroLine}>{t("plusTagline")}</Text>
        {plus.active && (
          <View style={styles.activePill}>
            <Icon name="checkmark.seal.fill" size={16} color={C.greenDark} />
            <Text style={styles.activeText}>{until ? `${t("plusActive")} · ${t("plusActiveUntil").replace("{date}", until)}` : `${t("plusActive")} · ${t("plusLifetime")}`}</Text>
          </View>
        )}
      </View>

      {/* Perks */}
      <Card style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
        {PLUS_PERKS.map((p, i) => (
          <Animated.View key={p} entering={FadeInDown.delay(i * 40).duration(220)} style={[styles.perk, i > 0 && styles.divider]}>
            <View style={[styles.perkIcon, { backgroundColor: PERK_ICON[p].color + "1F" }]}>
              <Icon name={PERK_ICON[p].icon} size={20} color={PERK_ICON[p].color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.headline}>{t(`plusPerk_${p}`)}</Text>
              <Text style={[T.body, { fontSize: 14 }]}>{p === "noCap" && practice ? `${t(`plusPerkDesc_${p}`)} (${t("plusTodayCap").replace("{used}", String(practice.used)).replace("{cap}", practice.cap === Infinity ? "∞" : String(practice.cap))})` : t(`plusPerkDesc_${p}`)}</Text>
            </View>
          </Animated.View>
        ))}
      </Card>
      <View style={styles.fair}>
        <Icon name="shield.fill" size={16} color={C.greenDark} />
        <Text style={[T.caption, { flex: 1, color: C.greenDark }]}>{t("plusFair")}</Text>
      </View>

      {/* Plans */}
      {!plus.active && (
        <>
          {offers === null ? (
            <ActivityIndicator style={{ marginTop: 28 }} color={C.green} />
          ) : offers.length === 0 ? (
            <Card style={{ marginTop: 20, alignItems: "center", gap: 10 }}>
              <Text style={[T.body, { textAlign: "center" }]}>{t("plusUnavailable")}</Text>
              {__DEV__ && <Button title={t("plusSimulate")} kind="secondary" small onPress={() => simulatePlus(true)} />}
            </Card>
          ) : (
            <>
              <View style={styles.plans}>
                {offers.map((o) => {
                  const on = o.plan === pick;
                  const tag = o.plan === "yearly" ? t("plusBest") : o.plan === "lifetime" ? t("plusOnce") : null;
                  return (
                    <Tap key={o.plan} onPress={() => (haptic.tap(), setPick(o.plan))} style={[styles.plan, on && styles.planOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      {tag && (
                        <View style={[styles.tag, on && { backgroundColor: "#FACC15" }]}>
                          <Text style={[styles.tagText, on && { color: "#3B2A05" }]}>{tag}</Text>
                        </View>
                      )}
                      <Text style={[styles.planName, on && { color: C.greenDark }]}>{t(`plus${o.plan[0].toUpperCase()}${o.plan.slice(1)}` as "plusMonthly" | "plusYearly" | "plusLifetime")}</Text>
                      <Text style={styles.planPrice}>{o.price}</Text>
                      {o.perMonth && <Text style={T.caption}>{t("plusPerMonth").replace("{price}", o.perMonth)}</Text>}
                      {o.trialDays > 0 && <Text style={[T.caption, { color: C.greenDark, fontWeight: "700" }]}>{t("plusTrial").replace("{n}", String(o.trialDays))}</Text>}
                    </Tap>
                  );
                })}
              </View>
              <Button
                title={busy ? "…" : chosen && chosen.trialDays > 0 ? t("plusTrial").replace("{n}", String(chosen.trialDays)) : t("plusSubscribe")}
                kind="gold"
                icon="crown.fill"
                disabled={busy || !chosen}
                onPress={buy}
                style={{ marginTop: 16 }}
              />
              <Text style={[T.caption, { textAlign: "center", marginTop: 10, lineHeight: 18 }]}>{t("plusLegal").replace("{store}", Platform.OS === "ios" ? "App Store" : "Google Play")}</Text>
            </>
          )}
        </>
      )}

      {/* Manage / restore / legal */}
      <View style={styles.links}>
        {plus.active && plus.source !== "dev" && <Tap onPress={() => Linking.openURL(MANAGE_URL)}><Text style={styles.link}>{t("plusManage")}</Text></Tap>}
        {plus.active && plus.source === "dev" && __DEV__ && <Tap onPress={() => simulatePlus(false)}><Text style={styles.link}>{t("plusSimulateOff")}</Text></Tap>}
        {available && <Tap onPress={restore} disabled={busy}><Text style={styles.link}>{t("plusRestore")}</Text></Tap>}
        <Tap onPress={() => Linking.openURL(TERMS_URL)}><Text style={styles.link}>{t("plusTerms")}</Text></Tap>
        <Tap onPress={() => Linking.openURL(PRIVACY_URL)}><Text style={styles.link}>{t("privacyPolicy")}</Text></Tap>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 8 },
  crown: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#FACC15", alignItems: "center", justifyContent: "center", ...shadow },
  heroTitle: { fontFamily: F.black, fontSize: 36, color: C.text, marginTop: 14 },
  heroLine: { ...T.body, fontSize: 16, textAlign: "center", marginTop: 2 },
  activePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 },
  activeText: { color: C.greenDark, fontWeight: "800", fontSize: 14 },
  perk: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  perkIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  fair: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.greenSoft, borderRadius: 12, padding: 10, marginTop: 10 },
  plans: { flexDirection: "row", gap: 10, marginTop: 24 },
  plan: { flex: 1, backgroundColor: C.card, borderRadius: R.card, borderWidth: 2, borderColor: C.border, padding: 12, paddingTop: 18, alignItems: "center", gap: 2, minHeight: 124, ...shadow, shadowOpacity: 0.05 },
  planOn: { borderColor: C.green, backgroundColor: "#F3FBF5" },
  tag: { position: "absolute", top: -11, backgroundColor: C.key, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: "800", color: C.text2 },
  planName: { fontFamily: F.display, fontSize: 18, color: C.text },
  planPrice: { fontFamily: F.black, fontSize: 22, color: C.text, marginTop: 2 },
  links: { alignItems: "center", gap: 12, marginTop: 28, marginBottom: 12 },
  link: { color: C.greenMid, fontWeight: "700", fontSize: 14 },
});
