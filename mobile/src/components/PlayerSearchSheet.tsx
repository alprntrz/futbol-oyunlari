import { useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { GridPlayer } from "@/data/players";
import { matchPlayers, searchPlayers } from "@/lib/tiki";

import { useI18n } from "~/lib/i18n";
import { C, R, T } from "~/lib/theme";

import { PlayerLine, PlayerToken } from "./PlayerRow";
import { Text } from "./Text";
import { Button, Icon, Tap } from "./ui";

/**
 * Bottom sheet to name a footballer. `accept` decides whether a player is a
 * valid answer; the sheet resolves typed text to the first accepted match and
 * calls `onSubmit` with that player, or null for a wrong answer.
 */
export function PlayerSearchSheet({
  visible,
  header,
  caption,
  captionColor = C.text2,
  used,
  accept,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  header?: React.ReactNode;
  caption?: string;
  captionColor?: string;
  used: Set<string>;
  accept: (p: GridPlayer) => boolean;
  onSubmit: (p: GridPlayer | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  // empty on every open: the sheet can also be shut from outside (turn moved on,
  // clock ran out) without close(), and on one shared phone the next player must
  // not find the last player's text
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setInput("");
  }
  const suggestions = useMemo(() => searchPlayers(input), [input]);

  const close = () => {
    setInput("");
    onClose();
  };

  const submit = (picked?: GridPlayer) => {
    const text = input.trim();
    if (!picked && !text) return;
    const candidates = picked ? [picked] : matchPlayers(text);
    const player = candidates.find((p) => !used.has(p.name) && accept(p)) ?? null;
    setInput("");
    onSubmit(player);
  };

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(11,18,32,0.35)" }} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.grabber} />
          {header}
          {caption ? <Text style={[T.caption, { textAlign: "center", marginVertical: 12, color: captionColor, fontWeight: "700" }]}>{caption}</Text> : null}
          <View style={styles.inputWrap}>
            <Icon name="magnifyingglass" size={16} color={C.text3} fallback="🔎" />
            <TextInput
              autoFocus
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => (suggestions.length === 1 ? submit(suggestions[0]) : submit())}
              placeholder={t("ttPlaceholder")}
              placeholderTextColor={C.text3}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              style={styles.input}
            />
          </View>
          {input.trim().length >= 2 && (
            <ScrollView style={styles.suggestions} keyboardShouldPersistTaps="handled">
              {suggestions.length === 0 ? (
                <Text style={[T.body, { textAlign: "center", padding: 14 }]}>{t("ttNoResult")}</Text>
              ) : (
                suggestions.map((p, i) => (
                  <Tap
                    key={p.name}
                    disabled={used.has(p.name)}
                    onPress={() => submit(p)}
                    style={[styles.suggestion, i > 0 && styles.divider, used.has(p.name) && { opacity: 0.4 }]}
                  >
                    <PlayerToken p={p} />
                    <PlayerLine p={p} />
                    {used.has(p.name) && <Icon name="checkmark" size={14} color={C.text3} fallback="✓" />}
                  </Tap>
                ))
              )}
            </ScrollView>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Button title={t("close")} kind="secondary" onPress={close} style={{ flex: 1 }} />
            <Button title={t("ttSubmit")} onPress={() => submit()} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "#D5DAE1", marginBottom: 14 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.bg, borderRadius: R.button, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 13, fontSize: 16, color: C.text },
  suggestions: { maxHeight: 230, marginTop: 10, borderRadius: R.button, borderWidth: 1, borderColor: C.border },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 9 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
});
