import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useAccount } from "~/lib/account";
import { useI18n } from "~/lib/i18n";
import { askPush, dismissPushAsk, pushAvailable, usePush, usePushPermission } from "~/lib/push";
import { C, T } from "~/lib/theme";

import { remindersDenied } from "./ReminderAsk";
import { Text } from "./Text";
import { Button, Card, Icon } from "./ui";

/**
 * Friends screen (signed in): asks once whether to send pushes for invites and new friends. The
 * OS prompt only comes after "Turn on" here; already allowed or already refused: no card.
 */
export function PushAsk() {
  const { t, locale } = useI18n();
  const account = useAccount();
  const { asked } = usePush();
  const permission = usePushPermission();
  if (!pushAvailable || !account || asked || permission !== "undetermined") return null;

  const yes = async () => {
    const granted = await askPush(locale, account.id);
    if (!granted) remindersDenied(t);
  };

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}>
      <Card style={styles.card}>
        <View style={styles.head}>
          <Icon name="bell.fill" size={22} color={C.amber} />
          <Text style={[T.headline, { flex: 1 }]}>{t("pushAskTitle")}</Text>
        </View>
        <Text style={[T.body, { marginTop: 6 }]}>{t("pushAskBody")}</Text>
        <View style={styles.buttons}>
          <Button title={t("pushAskNo")} kind="secondary" small onPress={dismissPushAsk} style={{ flex: 1 }} />
          <Button title={t("pushAskYes")} small onPress={yes} style={{ flex: 1 }} />
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, padding: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 12 },
});
