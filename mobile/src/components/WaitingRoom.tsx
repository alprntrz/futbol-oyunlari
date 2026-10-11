import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";

import type { Mark } from "~/lib/hattrick";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { MARK } from "./HatTrickBoard";
import { Text } from "./Text";
import { WaitingAnimation } from "./WaitingAnimation";
import { Button, Card, Icon, Tap } from "./ui";

/** Room code to share, the players so far, and Start for the host once two are in. */
export function WaitingRoom({
  code,
  players,
  nameOf,
  isHost,
  inviteText,
  peerLeft,
  onStart,
}: {
  code: string;
  players: { id: string; mark: Mark }[];
  nameOf: (p: { id: string }) => string;
  isHost: boolean;
  inviteText: string;
  peerLeft: boolean;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Card style={styles.codeCard}>
        <Text style={T.caption}>{t("roomCode")}</Text>
        <Tap onPress={copy} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`${t("roomCode")} ${code.split("").join(" ")}`}>
          <Text style={styles.code}>{code}</Text>
          <Icon name={copied ? "checkmark.circle.fill" : "doc.on.doc"} size={20} color={copied ? C.green : C.text3} fallback="⧉" />
        </Tap>
        <Button title={t("shareCode")} kind="secondary" icon="square.and.arrow.up" onPress={() => Share.share({ message: `${inviteText} ${code}` })} style={{ alignSelf: "stretch" }} />
      </Card>

      <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
        {players.map((p, i) => (
          <View key={p.id} style={[styles.player, i > 0 && styles.playerDivider]}>
            <View style={[styles.avatar, { backgroundColor: MARK[p.mark].soft }]}>
              <Text style={[styles.avatarMark, { color: MARK[p.mark].color }]}>{p.mark}</Text>
            </View>
            <Text style={[T.headline, { flex: 1 }]}>{nameOf(p)}</Text>
            {i === 0 && <Icon name="crown.fill" size={14} color={C.amber} fallback="👑" />}
          </View>
        ))}
      </Card>

      <View style={{ alignItems: "center", marginTop: 24, gap: 12 }}>
        {peerLeft && <Text style={[T.body, { color: C.red }]}>{t("htPeerLeft")}</Text>}
        {players.length < 2 && (
          <>
            <WaitingAnimation width={260} />
            <Text style={T.body}>{t("waiting")}</Text>
          </>
        )}
        {players.length >= 2 && isHost && <Button title={t("start")} icon="play.fill" onPress={onStart} style={{ alignSelf: "stretch" }} />}
        {players.length >= 2 && !isHost && <Text style={T.body}>{t("waitingHost")}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: "center", gap: 14, padding: 24 },
  code: { fontFamily: F.black, fontSize: 56, letterSpacing: 6, color: C.text },
  player: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  playerDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarMark: { fontFamily: F.black, fontSize: 20 },
});
