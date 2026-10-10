import { Alert, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

import { Text } from "./Text";
import { Button, Card } from "./ui";

/**
 * Draw and forfeit, under the board while a game is on.
 * `draw` is the pending offer from this player's point of view: "sent", "received" or null.
 */
export function GameActions({
  draw,
  onOfferDraw,
  onReplyDraw,
  onForfeit,
  disabled,
}: {
  draw: "sent" | "received" | null;
  onOfferDraw: () => void;
  onReplyDraw?: (accept: boolean) => void;
  onForfeit: () => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();

  const confirmForfeit = () =>
    Alert.alert(t("htForfeitAsk"), t("htForfeitAskDesc"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("htForfeit"), style: "destructive", onPress: onForfeit },
    ]);

  return (
    <View style={{ marginTop: 18, gap: 12 }}>
      {draw === "received" && onReplyDraw && (
        <Animated.View entering={FadeIn.duration(180)}>
          <Card style={styles.offer}>
            <Text style={[T.headline, { textAlign: "center" }]}>{t("htDrawOffered")}</Text>
            <View style={styles.row}>
              <Button title={t("htDecline")} kind="secondary" onPress={() => onReplyDraw(false)} style={{ flex: 1 }} />
              <Button title={t("htAccept")} onPress={() => onReplyDraw(true)} style={{ flex: 1 }} />
            </View>
          </Card>
        </Animated.View>
      )}
      <View style={styles.row}>
        <Button
          title={draw === "sent" ? t("htDrawSent") : t("htOfferDraw")}
          icon="equal.circle"
          kind="secondary"
          disabled={disabled || draw !== null}
          onPress={onOfferDraw}
          style={{ flex: 1 }}
        />
        <Button title={t("htForfeit")} icon="flag.fill" kind="danger" disabled={disabled} onPress={confirmForfeit} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  offer: { gap: 12, borderWidth: 1, borderColor: C.amber, backgroundColor: C.amberSoft },
});
