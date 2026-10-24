import { Alert, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import type { TKey } from "@/lib/strings";

import { useI18n } from "~/lib/i18n";
import { openAppSettings } from "~/lib/links";
import { usePlayStreak } from "~/lib/playStreak";
import { dismissReminderAsk, remindersAvailable, setRemindersOn, useReminders } from "~/lib/reminders";
import { C, T } from "~/lib/theme";

import { Text } from "./Text";
import { Button, Card, Icon } from "./ui";

/**
 * Home: asks once, after the first finished game of a day (never on first launch), whether
 * to send the 19:00 reminder. iOS's own permission prompt only comes after a "Yes" here.
 */
export function ReminderAsk() {
  const { t } = useI18n();
  const { asked } = useReminders();
  const { playedToday } = usePlayStreak();
  if (asked || !playedToday || !remindersAvailable) return null;

  const yes = async () => {
    const on = await setRemindersOn(true);
    if (!on) remindersDenied(t);
  };

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <Icon name="bell.fill" size={22} color={C.amber} />
          <Text style={[T.headline, { flex: 1 }]}>{t("remAskTitle")}</Text>
        </View>
        <Text style={[T.body, { marginTop: 6 }]}>{t("remAskBody")}</Text>
        <View style={styles.buttons}>
          <Button title={t("remAskNo")} kind="secondary" small onPress={dismissReminderAsk} style={{ flex: 1 }} />
          <Button title={t("remAskYes")} small onPress={yes} style={{ flex: 1 }} />
        </View>
      </Card>
    </Animated.View>
  );
}

/** Notifications are off for the app: say where to turn them on, with a shortcut. */
export function remindersDenied(t: (k: TKey) => string) {
  Alert.alert(t("remindersDenied"), undefined, [
    { text: "OK", style: "cancel" },
    { text: t("remOpenSettings"), onPress: openAppSettings },
  ]);
}

const styles = StyleSheet.create({
  card: { marginTop: 12, padding: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 12 },
});
