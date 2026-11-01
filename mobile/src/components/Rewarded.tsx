import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AD_RULES } from "@/lib/plus";

import { adsAvailable, showRewarded, useRewardedReady, type RewardedPlacement } from "~/lib/ads";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { purchasesAvailable, usePlus } from "~/lib/plus";
import { play } from "~/lib/sound";
import { C, F, R, T } from "~/lib/theme";
import { liftPracticeCap, onCapHit, onOverlay, onRewardOpen, type CapHit } from "~/lib/xp";

import { Text } from "./Text";
import { Button, Icon } from "./ui";

type IconName = Parameters<typeof Icon>[0]["name"];

/**
 * The one sheet behind every rewarded ad: what you get, "Watch an ad" (ready or loading),
 * Tiktako Plus as the way to never need the ad, and "Not now". `onEarned` runs only after the
 * video was watched through. With Plus (or no ads in this build) the caller shouldn't open it.
 */
export function RewardedSheet({
  visible,
  onClose,
  placement,
  icon,
  color,
  title,
  body,
  cta,
  plusHint,
  onEarned,
}: {
  visible: boolean;
  onClose: () => void;
  placement: RewardedPlacement;
  icon: IconName;
  color: string;
  title: string;
  body: string;
  cta: string;
  /** one line under the Plus button, e.g. "Free with Plus" */
  plusHint?: string;
  onEarned: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const ready = useRewardedReady();
  const plus = usePlus().active;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const ads = adsAvailable() && !plus;
  const canBuy = purchasesAvailable() && !plus;

  const watch = async () => {
    setBusy(true);
    setFailed(false);
    const res = await showRewarded(placement);
    setBusy(false);
    if (res === "earned") {
      haptic.success();
      play("coin");
      await onEarned();
      onClose();
    } else if (res === "unavailable") setFailed(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t("close")} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.badge, { backgroundColor: color + "22" }]}>
          <Icon name={icon} size={30} color={color} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={[T.body, { textAlign: "center", marginTop: 6 }]}>{body}</Text>
        {failed && <Text style={[T.caption, { color: C.red, textAlign: "center", marginTop: 8 }]}>{t("adUnavailable")}</Text>}

        <View style={{ alignSelf: "stretch", marginTop: 18, gap: 10 }}>
          {ads && (
            <Button
              title={busy ? t("adLoading") : ready ? cta : t("adLoading")}
              kind="gold"
              icon={ready && !busy ? "play.rectangle.fill" : undefined}
              left={!ready || busy ? <ActivityIndicator color="#3B2A05" /> : undefined}
              disabled={busy}
              onPress={watch}
            />
          )}
          {canBuy && (
            <View>
              <Button
                title={t("plusName")}
                kind={ads ? "secondary" : "primary"}
                icon="crown.fill"
                onPress={() => {
                  onClose();
                  router.push("/plus");
                }}
              />
              {plusHint ? <Text style={[T.caption, { textAlign: "center", marginTop: 6 }]}>{plusHint}</Text> : null}
            </View>
          )}
          <Button title={t("adNoThanks")} kind="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/**
 * Root layout: the practice-XP cap was hit (lib/xp.ts onCapHit) → once the victory / reward
 * screens have closed, offer an ad for AD_RULES.capLiftXp more, or Plus. Never for Plus players
 * (they have no cap) and never when neither ads nor purchases exist in this build.
 */
export function CapSheetHost() {
  const { t } = useI18n();
  const plus = usePlus().active;
  const [hit, setHit] = useState<CapHit | null>(null);
  const [pending, setPending] = useState<CapHit | null>(null);
  const [overlay, setOverlay] = useState(false);
  const [reward, setReward] = useState(false);

  useEffect(() => onCapHit((c) => setPending((p) => p ?? c)), []);
  useEffect(() => onOverlay(setOverlay), []);
  useEffect(() => onRewardOpen(setReward), []);
  useEffect(() => {
    if (!pending || overlay || reward || hit) return;
    const id = setTimeout(() => {
      setHit(pending);
      setPending(null);
    }, 700);
    return () => clearTimeout(id);
  }, [pending, overlay, reward, hit]);

  if (!hit || plus || (!adsAvailable() && !purchasesAvailable())) return null;
  const canLift = hit.liftsLeft > 0 && adsAvailable();
  const body = canLift
    ? t("capBody").replace("{n}", String(AD_RULES.capLiftXp)).replace("{left}", String(hit.liftsLeft))
    : t("capBodyNoLift");
  return (
    <RewardedSheet
      visible
      onClose={() => setHit(null)}
      placement="capLift"
      icon="bolt.fill"
      color={C.amber}
      title={t("capTitle")}
      body={body}
      cta={t("adWatch")}
      plusHint={t("plusPerkDesc_noCap")}
      onEarned={async () => {
        await liftPracticeCap();
      }}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 22, alignItems: "center" },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.display, fontSize: 26, lineHeight: 30, color: C.text, textAlign: "center", marginTop: 12, borderRadius: R.card },
});
