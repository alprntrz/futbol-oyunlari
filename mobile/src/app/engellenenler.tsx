import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Text } from "~/components/Text";
import { Button, Card, Page } from "~/components/ui";
import { unblockPlayer, useBlocked } from "~/lib/blocks";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Settings > Blocked players: everyone this phone blocked (lib/blocks.ts), each with Unblock. */
export default function BlockedPlayers() {
  const { t } = useI18n();
  const blocked = useBlocked();
  return (
    <Page>
      <Stack.Screen options={{ title: t("blockedTitle") }} />
      {blocked.length === 0 ? (
        <Text style={[T.body, styles.empty]}>{t("blockedNone")}</Text>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {blocked.map((b, i) => (
            <View key={b.ref} style={[styles.row, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={T.headline} numberOfLines={1}>
                  {b.nick || "?"}
                </Text>
                <Text style={T.caption}>{new Date(b.at).toLocaleDateString()}</Text>
              </View>
              <Button title={t("pmUnblock")} kind="secondary" small onPress={() => unblockPlayer(b.ref)} />
            </View>
          ))}
        </Card>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", marginTop: 40, color: C.text2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
});
