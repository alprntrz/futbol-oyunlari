import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PLUS_FOREVER, PLUS_PERKS, type PlusPerk } from "@/lib/plus";

import { Text } from "~/components/Text";
import { Button, Card, Icon, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { openPage, PRIVACY_URL } from "~/lib/links";
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

const TERMS_URL = Platform.select({ ios: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/", android: "https://alprntrz.github.io/futbol-oyunlari/terms.html" })!;
const MANAGE_URL = Platform.select({ ios: "https://apps.apple.com/account/subscriptions", android: "https://play.google.com/store/account/subscriptions" })!;

/**
 * The paywall. One subscription, three ways to pay (yearly picked by default), what it gives and,
 * just as clearly, what it doesn't: nothing inside a match. Store prices come in the player's own
 * currency through RevenueCat; the small print says how renewal and cancelling work (App Store 3.1.2).
 */
export default function PlusScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
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

  const canBuy = !plus.active && !!offers && offers.length > 0;
  const store = Platform.OS === "ios" ? "App Store" : "Google Play";
  const planName = (p: PlusOffer["plan"]) => t(`plus${p[0].toUpperCase()}${p.slice(1)}` as "plusMonthly" | "plusYearly" | "plusLifetime");

  // one screen: the middle scrolls on small phones, the buy button and its terms never leave the bottom (App Store 3.1.2)
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* the hero carries the name (no repeated title); the modal gets a close button */}
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("close")}>
              <Icon name="xmark" size={20} color={C.text} fallback="✕" />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <View style={styles.crown}>
            <Icon name="crown.fill" size={24} color="#3B2A05" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{t("plusName")}</Text>
            <Text style={styles.heroLine}>{t("plusTagline")}</Text>
          </View>
        </View>
        {plus.active && (
          <View style={styles.activePill}>
            <Icon name="checkmark.seal.fill" size={16} color={C.greenDark} />
            <Text style={styles.activeText}>{until ? `${t("plusActive")} · ${t("plusActiveUntil").replace("{date}", until)}` : `${t("plusActive")} · ${t("plusLifetime")}`}</Text>
          </View>
        )}

        <Card style={{ padding: 0, overflow: "hidden", marginTop: 14 }}>
          {PLUS_PERKS.map((p, i) => (
            <Animated.View key={p} entering={FadeInDown.delay(i * 30).duration(200)} style={[styles.perk, i > 0 && styles.divider]}>
              <View style={[styles.perkIcon, { backgroundColor: PERK_ICON[p].color + "1F" }]}>
                <Icon name={PERK_ICON[p].icon} size={16} color={PERK_ICON[p].color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.perkTitle} numberOfLines={1}>{t(`plusPerk_${p}`)}</Text>
                <Text style={styles.perkDesc} numberOfLines={1}>{p === "noCap" && practice ? `${t(`plusPerkDesc_${p}`)} (${t("plusTodayCap").replace("{used}", String(practice.used)).replace("{cap}", practice.cap === Infinity ? "∞" : String(practice.cap))})` : t(`plusPerkDesc_${p}`)}</Text>
              </View>
            </Animated.View>
          ))}
        </Card>
        <View style={styles.fair}>
          <Icon name="shield.fill" size={14} color={C.greenDark} />
          <Text style={[T.caption, { flex: 1, color: C.greenDark }]}>{t("plusFair")}</Text>
        </View>

        {!plus.active &&
          (offers === null ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={C.green} />
          ) : offers.length === 0 ? (
            <Card style={{ marginTop: 16, alignItems: "center", gap: 10 }}>
              <Text style={[T.body, { textAlign: "center" }]}>{t("plusUnavailable")}</Text>
              {__DEV__ && <Button title={t("plusSimulate")} kind="secondary" small onPress={() => simulatePlus(true)} />}
            </Card>
          ) : (
            <View style={styles.plans} accessibilityRole="radiogroup">
              {offers.map((o) => {
                const on = o.plan === pick;
                const tag = o.plan === "yearly" ? t("plusBest") : o.plan === "lifetime" ? t("plusOnce") : null;
                const sub = o.trialDays > 0 ? t("plusTrial").replace("{n}", String(o.trialDays)) : o.perMonth ? t("plusPerMonth").replace("{price}", o.perMonth) : null;
                return (
                  <Tap key={o.plan} onPress={() => (haptic.tap(), setPick(o.plan))} style={[styles.plan, on && styles.planOn]} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                    <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.radioDot} />}</View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.planName, on && { color: C.greenDark }]}>{planName(o.plan)}</Text>
                        {tag && (
                          <View style={[styles.tag, o.plan === "yearly" && { backgroundColor: "#FACC15" }]}>
                            <Text style={[styles.tagText, o.plan === "yearly" && { color: "#3B2A05" }]}>{tag}</Text>
                          </View>
                        )}
                      </View>
                      {sub && <Text style={[T.caption, o.trialDays > 0 && { color: C.greenDark, fontWeight: "700" }]}>{sub}</Text>}
                    </View>
                    <Text style={styles.planPrice}>{o.price}</Text>
                  </Tap>
                );
              })}
            </View>
          ))}

        <View style={styles.links}>
          {plus.active && plus.source !== "dev" && <Tap onPress={() => Linking.openURL(MANAGE_URL)}><Text style={styles.link}>{t("plusManage")}</Text></Tap>}
          {plus.active && plus.source === "dev" && __DEV__ && <Tap onPress={() => simulatePlus(false)}><Text style={styles.link}>{t("plusSimulateOff")}</Text></Tap>}
          {available && <Tap onPress={restore} disabled={busy} hitSlop={8}><Text style={styles.link}>{t("plusRestore")}</Text></Tap>}
          <Tap onPress={() => openPage(TERMS_URL, t("linkFailed"))} hitSlop={8}><Text style={styles.link}>{t("plusTerms")}</Text></Tap>
          <Tap onPress={() => openPage(PRIVACY_URL, t("linkFailed"))} hitSlop={8}><Text style={styles.link}>{t("privacyPolicy")}</Text></Tap>
        </View>
      </ScrollView>

      {canBuy && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Button
            title={busy ? "…" : chosen && chosen.trialDays > 0 ? t("plusTrial").replace("{n}", String(chosen.trialDays)) : t("plusSubscribe")}
            kind="gold"
            icon="crown.fill"
            disabled={busy || !chosen}
            onPress={buy}
          />
          {chosen && chosen.plan !== "lifetime" && (
            <Text style={styles.billing}>
              {chosen.trialDays > 0
                ? t("plusAfterTrial").replace("{n}", String(chosen.trialDays)).replace("{price}", chosen.price)
                : `${planName(chosen.plan)} · ${chosen.price}`}
            </Text>
          )}
          <Text style={styles.legal}>{t("plusLegal").replace("{store}", store)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, width: "100%", maxWidth: 560, alignSelf: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: 12 },
  crown: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FACC15", alignItems: "center", justifyContent: "center", ...shadow },
  heroTitle: { fontFamily: F.black, fontSize: 26, color: C.text },
  heroLine: { ...T.body, fontSize: 14 },
  activePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12, alignSelf: "flex-start" },
  activeText: { color: C.greenDark, fontWeight: "800", fontSize: 14 },
  perk: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 7 },
  perkIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  perkTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  perkDesc: { fontSize: 12.5, color: C.text2 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  fair: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.greenSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
  plans: { gap: 8, marginTop: 14 },
  plan: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.card, borderWidth: 2, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10, minHeight: 56 },
  planOn: { borderColor: C.green, backgroundColor: "#F3FBF5" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: C.green },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.green },
  tag: { backgroundColor: C.key, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10.5, fontWeight: "800", color: C.text2 },
  planName: { fontFamily: F.display, fontSize: 17, color: C.text },
  planPrice: { fontFamily: F.black, fontSize: 19, color: C.text },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 18, rowGap: 8, marginTop: 16 },
  link: { color: C.greenMid, fontWeight: "700", fontSize: 13 },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: C.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  billing: { textAlign: "center", marginTop: 8, fontSize: 13, fontWeight: "700", color: C.text },
  legal: { textAlign: "center", marginTop: 4, fontSize: 10.5, lineHeight: 14, color: C.text2 },
});
