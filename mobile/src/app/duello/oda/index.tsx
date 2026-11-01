import { router, Stack } from "expo-router";

import { OnlineLobby } from "~/components/OnlineLobby";
import { Text } from "~/components/Text";
import { Button, Page } from "~/components/ui";
import { useDuel } from "~/lib/duel";
import { useI18n } from "~/lib/i18n";
import { T } from "~/lib/theme";

/** Card Duel with a friend: open a room or join one by code; both bring their own drafted hand. */
export default function DuelLobby() {
  const { t } = useI18n();
  const { hand, ready } = useDuel();
  if (!ready) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("dzName") }} />
        <Text style={[T.body, { textAlign: "center", marginTop: 30 }]}>{t("dzNoHand")}</Text>
        <Button title={t("dzDraft")} icon="square.stack.fill" onPress={() => router.replace("/duello/draft")} style={{ marginTop: 16 }} />
      </Page>
    );
  }
  return (
    <OnlineLobby
      game="dz"
      title={t("dzName")}
      createPayload={() => ({ hand })}
      joinPayload={() => ({ hand })}
      roomHref={(code) => ({ pathname: "/duello/oda/[code]", params: { code } })}
    />
  );
}
