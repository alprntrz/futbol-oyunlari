import type { SymbolViewProps } from "expo-symbols";
import { Stack } from "expo-router";
import { useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { InfoSheet } from "./HowTo";
import { Text } from "./Text";
import { Icon, Page, Tap } from "./ui";

export interface HubAction {
  label: string;
  /** one short line under a secondary option */
  hint?: string;
  icon: SymbolViewProps["name"];
  fallback: string;
  onPress: () => void;
}

/**
 * Every game's first screen looks the same: big art, one sentence, ONE big
 * button that starts the usual way to play, then a few small other ways, then
 * small settings rows (league, difficulty…) with their defaults already picked.
 * The rules live behind "?" (and in the game itself), never in the way.
 */
export function GameHub({
  title,
  image,
  bg,
  tagline,
  primary,
  status,
  secondary = [],
  settings,
  rules,
  children,
}: {
  title: string;
  image: ImageSourcePropType;
  /** soft colour behind the art */
  bg: string;
  tagline: string;
  primary: HubAction;
  /** a line above the button, e.g. "Today's card: 9/16" */
  status?: string;
  secondary?: HubAction[];
  /** small rows under the buttons: settings that already have a default */
  settings?: React.ReactNode;
  /** how to play, behind "?" */
  rules?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [help, setHelp] = useState(false);

  return (
    <Page>
      <Stack.Screen
        options={{
          title,
          headerRight: rules
            ? () => (
                <Pressable onPress={() => setHelp(true)} hitSlop={10} accessibilityLabel={t("howToPlay")}>
                  <Icon name="questionmark.circle" size={22} color={C.text} fallback="?" />
                </Pressable>
              )
            : undefined,
        }}
      />
      <View style={styles.hero}>
        <Animated.View entering={FadeIn.duration(250)} style={[styles.art, { backgroundColor: bg }]}>
          <Image source={image} style={styles.artImage} />
        </Animated.View>
        <Text style={styles.tagline}>{tagline}</Text>
      </View>

      {status && <Text style={styles.status}>{status}</Text>}
      <View style={{ marginTop: status ? 8 : 18 }}>
        <Tap onPress={() => (haptic.press(), primary.onPress())} style={styles.primary} accessibilityLabel={primary.label}>
          <Icon name={primary.icon} size={20} color="#3B2A05" fallback={primary.fallback} />
          <Text style={styles.primaryText} numberOfLines={1} adjustsFontSizeToFit>
            {primary.label}
          </Text>
        </Tap>
      </View>

      {secondary.length > 0 && (
        <View style={styles.secondary}>
          {secondary.map((a) => (
            <Tap key={a.label} onPress={() => (haptic.tap(), a.onPress())} style={styles.sec} accessibilityLabel={a.hint ? `${a.label}. ${a.hint}` : a.label}>
              <Icon name={a.icon} size={18} color={C.greenDark} fallback={a.fallback} />
              <Text style={styles.secText} numberOfLines={1} adjustsFontSizeToFit>
                {a.label}
              </Text>
              {a.hint && (
                <Text style={styles.secHint} numberOfLines={2}>
                  {a.hint}
                </Text>
              )}
            </Tap>
          ))}
        </View>
      )}

      {settings && <Animated.View entering={FadeIn.delay(150)} style={styles.settings}>{settings}</Animated.View>}
      {children}

      {rules && (
        <InfoSheet visible={help} onClose={() => setHelp(false)} title={title}>
          {rules}
        </InfoSheet>
      )}
    </Page>
  );
}

/** A settings row: "League · All clubs ›". */
export function HubSetting({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Tap onPress={() => (haptic.tap(), onPress())} style={styles.setting} accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue} numberOfLines={1}>
        {value}
      </Text>
      <Icon name="chevron.right" size={13} color={C.text3} fallback="›" />
    </Tap>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: 12, marginTop: 4 },
  art: { width: 168, height: 168, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  artImage: { width: 128, height: 128, resizeMode: "contain" },
  tagline: { ...T.body, fontSize: 18, lineHeight: 24, textAlign: "center", color: C.text2, maxWidth: 340 },
  status: { textAlign: "center", fontWeight: "700", color: C.greenDark, marginTop: 16 },
  primary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 64, borderRadius: 20, backgroundColor: "#FACC15", borderBottomWidth: 5, borderBottomColor: "#CA8A04" },
  primaryText: { fontFamily: F.black, fontSize: 26, color: "#3B2A05" },
  secondary: { flexDirection: "row", gap: 10, marginTop: 12 },
  sec: { flex: 1, alignItems: "center", gap: 3, backgroundColor: C.card, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 6, borderWidth: 1, borderColor: C.border },
  secText: { fontFamily: F.display, fontSize: 17, color: C.text },
  secHint: { fontSize: 12, color: C.text3, textAlign: "center" },
  settings: { marginTop: 18, backgroundColor: C.card, borderRadius: 16, overflow: "hidden" },
  setting: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  settingLabel: { fontSize: 15, color: C.text2 },
  settingValue: { flex: 1, textAlign: "right", fontWeight: "700", fontSize: 15, color: C.text },
});

/** Pick one of a few options from a bottom sheet (league, difficulty…). */
export function ChoiceSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: T; label: string; hint?: string; left?: React.ReactNode }[];
  value: T;
  onPick: (v: T) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheet.backdrop} onPress={onClose} />
      <View style={[sheet.body, { paddingBottom: insets.bottom + 16 }]}>
        <View style={sheet.grabber} />
        <Text style={[T.title, { marginBottom: 6 }]}>{title}</Text>
        <ScrollView style={{ maxHeight: 460 }}>
          {options.map((o, i) => (
            <Tap key={o.value} onPress={() => (haptic.tap(), onPick(o.value), onClose())} style={[sheet.row, i > 0 && sheet.divider]} accessibilityLabel={o.label}>
              {o.left}
              <View style={{ flex: 1 }}>
                <Text style={sheet.label}>{o.label}</Text>
                {o.hint && <Text style={T.caption}>{o.hint}</Text>}
              </View>
              {o.value === value && <Icon name="checkmark.circle.fill" size={22} color={C.greenMid} fallback="✓" />}
            </Tap>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(11,18,32,0.35)" },
  body: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 4 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  label: { fontFamily: F.display, fontSize: 19, color: C.text },
});
