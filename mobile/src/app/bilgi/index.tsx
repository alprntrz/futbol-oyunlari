import { Stack } from "expo-router";
import { View } from "react-native";

import { ModeList, type Mode } from "~/components/ModeGrid";
import { Text } from "~/components/Text";
import { Card, Icon, Page, SectionLabel } from "~/components/ui";
import { useI18n } from "~/lib/i18n";
import { C, T } from "~/lib/theme";

/** Football Quiz hub: random online room or a room with friends. */
export default function QuizHome() {
  const { t } = useI18n();
  const modes: Mode[] = [
    { icon: "antenna.radiowaves.left.and.right", fallback: "📡", title: t("htRandom"), desc: t("qzRandomDesc"), href: "/bilgi/rastgele", color: C.blue, soft: C.blueSoft },
    { icon: "person.3.fill", fallback: "👥", title: t("htFriend"), desc: t("qzFriendsDesc"), href: "/bilgi/oda", color: C.greenMid, soft: C.greenSoft },
  ];

  return (
    <Page>
      <Stack.Screen options={{ title: t("qzName") }} />
      <Text style={T.title}>{t("qzName")}</Text>
      <Text style={[T.body, { marginTop: 4 }]}>{t("qzTagline")}</Text>

      <SectionLabel>{t("htModes")}</SectionLabel>
      <ModeList modes={modes} />

      <SectionLabel>{t("howToPlay")}</SectionLabel>
      <Card style={{ gap: 12 }}>
        {(
          [
            ["questionmark.circle.fill", t("qzRule1")],
            ["bolt.fill", t("qzRule2")],
            ["person.3.fill", t("qzRule3")],
          ] as const
        ).map(([icon, text]) => (
          <View key={text} style={{ flexDirection: "row", gap: 10 }}>
            <Icon name={icon} size={17} color={C.greenMid} fallback="•" />
            <Text style={[T.body, { flex: 1 }]}>{text}</Text>
          </View>
        ))}
      </Card>
    </Page>
  );
}
