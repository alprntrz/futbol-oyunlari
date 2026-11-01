import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { blockPlayer, unblockPlayer, useBlocked, type Blocked } from "~/lib/blocks";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { C, F, T } from "~/lib/theme";

import { Text } from "./Text";
import { Button, Icon, Tap } from "./ui";

/**
 * Report / block another player (Apple guideline 1.2), from anywhere their nickname shows:
 * `openPlayerMenu({ ref, nick, game })`, drawn by <PlayerMenuHost /> in the root layout.
 * A report goes to the server (server-refs.js) with a reason; blocking keeps them out of your
 * matches, quiz rooms and invites and hides their name in lists (lib/blocks.ts).
 */
export interface PlayerMenuTarget {
  ref: string;
  nick: string;
  /** where it happened: "ht" | "pp" | "dz" | "qz" | "board" | "league" | "friends" */
  game: string;
  /** an extra first action (e.g. "Remove friend") */
  extra?: { label: string; onPress: () => void; danger?: boolean };
  /** after blocking (e.g. leave the friend list) */
  onBlocked?: () => void;
}

let show: ((t: PlayerMenuTarget | PlayerMenuTarget[]) => void) | null = null;
/** One player, or several (a quiz room): then the sheet first asks which one. */
export function openPlayerMenu(target: PlayerMenuTarget | PlayerMenuTarget[]) {
  haptic.tap();
  show?.(target);
}

type Step = "pick" | "menu" | "reasons" | "block" | "reported" | "blocked" | "failed";
type Reason = "nick" | "cheat" | "other";

export function PlayerMenuHost() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const blocked = useBlocked();
  const [target, setTarget] = useState<PlayerMenuTarget | null>(null);
  const [choices, setChoices] = useState<PlayerMenuTarget[]>([]);
  const [step, setStep] = useState<Step>("menu");

  useEffect(() => {
    show = (tg) => {
      if (Array.isArray(tg)) {
        if (!tg.length) return;
        setChoices(tg);
        setTarget(tg[0]);
        setStep(tg.length > 1 ? "pick" : "menu");
        return;
      }
      setChoices([]);
      setTarget(tg);
      setStep("menu");
    };
    return () => {
      show = null;
    };
  }, []);

  const close = () => setTarget(null);
  if (!target) return null;
  const isBlocked = blocked.some((b: Blocked) => b.ref === target.ref);

  const report = (reason: Reason) => {
    const socket = getSocket();
    const timer = setTimeout(() => setStep("failed"), 5000);
    socket.emit("rep:send", { ref: target.ref, nick: target.nick, reason, game: target.game }, (res?: { ok: boolean }) => {
      clearTimeout(timer);
      haptic.success();
      setStep(res?.ok ? "reported" : "failed");
    });
  };
  const block = async () => {
    await blockPlayer(target.ref, target.nick);
    haptic.success();
    setStep("blocked");
    target.onBlocked?.();
  };

  const row = (label: string, onPress: () => void, opts: { icon?: Parameters<typeof Icon>[0]["name"]; danger?: boolean } = {}) => (
    <Tap key={label} onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      {opts.icon && <Icon name={opts.icon} size={20} color={opts.danger ? C.red : C.text} />}
      <Text style={[styles.label, opts.danger && { color: C.red }]}>{label}</Text>
    </Tap>
  );

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t("cancel")} />
      <View style={[styles.body, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={[T.title, { marginBottom: 6 }]} numberOfLines={1}>
          {step === "pick" ? t("pmMenu") : target.nick || "?"}
        </Text>

        {step === "pick" && <View>{choices.map((c) => row(c.nick || "?", () => (setTarget(c), setStep("menu")), { icon: "person.fill" }))}</View>}

        {step === "menu" && (
          <View>
            {target.extra && row(target.extra.label, () => (close(), target.extra?.onPress()), { danger: target.extra.danger })}
            {row(t("pmReport"), () => setStep("reasons"), { icon: "flag.fill" })}
            {isBlocked
              ? row(t("pmUnblock"), () => (unblockPlayer(target.ref), close()), { icon: "hand.raised.fill" })
              : row(t("pmBlock"), () => setStep("block"), { icon: "hand.raised.fill", danger: true })}
          </View>
        )}

        {step === "reasons" && (
          <View>
            <Text style={[T.caption, { marginBottom: 4 }]}>{t("pmWhy")}</Text>
            {row(t("pmReasonNick"), () => report("nick"))}
            {row(t("pmReasonCheat"), () => report("cheat"))}
            {row(t("pmReasonOther"), () => report("other"))}
          </View>
        )}

        {step === "block" && (
          <View style={{ gap: 12 }}>
            <Text style={T.body}>{t("pmBlockBody")}</Text>
            <Button title={t("pmBlock")} icon="hand.raised.fill" kind="danger" onPress={block} />
            <Button title={t("cancel")} kind="secondary" onPress={close} />
          </View>
        )}

        {(step === "reported" || step === "blocked" || step === "failed") && (
          <View style={{ gap: 12 }}>
            <Text style={T.body}>{step === "reported" ? t("pmReported") : step === "blocked" ? t("pmBlocked") : t("pmFailed")}</Text>
            {step === "reported" && !isBlocked && <Button title={t("pmAlsoBlock")} kind="secondary" icon="hand.raised.fill" onPress={() => setStep("block")} />}
            <Button title={t("close")} onPress={close} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  body: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  label: { fontFamily: F.display, fontSize: 19, color: C.text },
  button: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});

/** A round "…" button (beside the emote button in a match's header) that opens the menu for the opponent. */
export function PlayerMenuButton({ target, color = "white", bg = "rgba(255,255,255,0.14)" }: { target: PlayerMenuTarget | null; color?: string; bg?: string }) {
  const { t } = useI18n();
  if (!target?.ref) return null;
  return (
    <Tap onPress={() => openPlayerMenu(target)} style={[styles.button, { backgroundColor: bg }]} accessibilityRole="button" accessibilityLabel={`${t("pmMenu")}: ${target.nick}`}>
      <Icon name="ellipsis.circle" size={18} color={color} fallback="…" />
    </Tap>
  );
}
