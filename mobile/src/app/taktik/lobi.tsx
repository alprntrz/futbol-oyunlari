import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Share, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import type { CoachId } from "@/lib/taktik/types";

import { Avatar } from "~/components/Avatar";
import { softIn } from "~/components/motion";
import { RankChip } from "~/components/Rank";
import { SignInCard } from "~/components/SignInCard";
import { Text } from "~/components/Text";
import { Button, Card, Icon, SectionLabel, Page, Tap } from "~/components/ui";
import { fetchFriends, useAccount, type Friend } from "~/lib/account";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { getSocket } from "~/lib/socket";
import { createRoom, joinRoom, leaveRoom, startRoom, startTaktik, useTaktik } from "~/lib/taktik";
import { C, F, GAME, R, T } from "~/lib/theme";

/** host + 4 friends; the server fills the other seats */
const MAX_HUMANS = 5;

/**
 * Pitch Chess lobby: Start on the hub opens one (I'm the host), a friend's invite
 * joins one (`code`). The host invites friends (up to 4) and starts; alone, Start
 * plays the solo game on this phone. When the server starts the game, everyone
 * goes to the board.
 */
export default function TaktikLobby() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ code?: string; coach?: CoachId }>();
  const coach: CoachId = params.coach === "bus" || params.coach === "press" ? params.coach : "pass";
  const { online } = useTaktik();
  const account = useAccount();
  const [status, setStatus] = useState<"opening" | "ready" | "offline" | "error">("opening");
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  /** leaving this screen for the board: the lobby isn't left */
  const toBoard = useRef(false);

  // open my lobby, or join the friend's
  useEffect(() => {
    let live = true;
    (async () => {
      if (params.code) {
        const r = await joinRoom(params.code, coach);
        if (!live) return;
        if (r === "ok") return setStatus("ready");
        setError(t(r === "full" ? "ttkLobbyFull" : r === "started" ? "ttkLobbyStarted" : r === "gone" ? "ttkLobbyGone" : r === "not_found" ? "ttkLobbyNotFound" : "ttkLobbyOffline"));
        return setStatus("error");
      }
      const code = await createRoom(coach);
      if (live) setStatus(code ? "ready" : "offline");
    })();
    return () => {
      live = false;
      // backing out of the lobby leaves it (not when the game starts)
      if (!toBoard.current) leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // signed in: my friends, to invite
  useEffect(() => {
    if (!account) return;
    fetchFriends()
      .then((f) => setFriends(f.friends))
      .catch(() => setFriends([]));
  }, [account]);

  // the server started the game: to the board
  useEffect(() => {
    if (!online || online.phase === "lobby" || toBoard.current) return;
    toBoard.current = true;
    haptic.success();
    router.replace("/taktik/oyun");
  }, [online]);

  const seats = online?.seats ?? [];
  const me = seats.find((s) => s.id === online?.you);
  const host = !!me?.host;

  const start = async () => {
    if (starting) return;
    setStarting(true);
    // alone: the solo game, on this phone (no server needed)
    if (seats.length <= 1) {
      toBoard.current = true;
      leaveRoom();
      await startTaktik(coach);
      router.replace("/taktik/oyun");
      return;
    }
    const r = await startRoom();
    if (!r?.ok) setStarting(false);
  };

  const solo = async () => {
    toBoard.current = true;
    await startTaktik(coach);
    router.replace("/taktik/oyun");
  };

  const invite = (f: Friend) => {
    if (!online || !f.online) return;
    getSocket()
      .timeout(6000)
      .emit("fr:invite", { to: f.code, game: "tt", room: online.code }, (err: Error | null, r?: { ok: boolean }) => {
        if (err || !r?.ok) return haptic.error();
        haptic.success();
        setInvited((s) => new Set(s).add(f.code));
      });
  };

  return (
    <Page>
      <Stack.Screen options={{ title: t("ttkLobby") }} />
      {status === "opening" && <ActivityIndicator style={{ marginTop: 40 }} />}

      {(status === "offline" || status === "error") && (
        <Card style={{ gap: 12, marginTop: 8 }}>
          <Text style={T.body}>{error ?? t("ttkLobbyOffline")}</Text>
          <Button title={t("ttkLobbySolo")} icon="play.fill" kind="gold" onPress={solo} />
        </Card>
      )}

      {status === "ready" && online && (
        <>
          {/* the code (friends can also join with it) */}
          <Tap onPress={() => Share.share({ message: online.code })} style={styles.codeCard} accessibilityLabel={`${t("ttkLobbyCode")} ${online.code.split("").join(" ")}`}>
            <Text style={T.caption}>{t("ttkLobbyCode")}</Text>
            <Text style={styles.code} selectable>
              {online.code}
            </Text>
          </Tap>

          <SectionLabel>{t("ttkLobbySeats").replace("{n}", String(seats.length)).replace("{m}", String(MAX_HUMANS))}</SectionLabel>
          <Card style={{ paddingVertical: 4 }}>
            {Array.from({ length: MAX_HUMANS }, (_, i) => {
              const s = seats[i];
              return (
                <Animated.View key={s ? `s${s.id}` : `e${i}`} entering={softIn(i)} style={[styles.row, i > 0 && styles.divider]}>
                  {s ? (
                    <>
                      <Avatar id={s.id === online.you ? null : s.avatar} me={s.id === online.you} size={40} frame={s.frame} />
                      <Text style={[styles.nick, s.id === online.you && { color: C.greenMid }]} numberOfLines={1}>
                        {s.id === online.you ? t("you") : s.nick}
                      </Text>
                      {s.host && (
                        <View style={styles.hostChip}>
                          <Text style={styles.hostText}>{t("ttkLobbyHost")}</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={styles.emptySeat}>
                        <Icon name="person.fill" size={18} color={C.text3} fallback="👤" />
                      </View>
                      <Text style={[styles.nick, { color: C.text3, fontFamily: undefined, fontSize: 15 }]}>{t("ttkLobbyWait")}</Text>
                    </>
                  )}
                </Animated.View>
              );
            })}
          </Card>
          <Text style={[T.caption, { marginTop: 8, textAlign: "center" }]}>{t("ttkLobbyFill")}</Text>

          {host ? (
            <Button
              title={seats.length > 1 ? t("ttkLobbyStart") : t("ttkLobbyStartSolo")}
              icon="play.fill"
              kind="gold"
              disabled={starting}
              onPress={start}
              style={{ marginTop: 16 }}
            />
          ) : (
            <View style={styles.waitHost}>
              <ActivityIndicator />
              <Text style={T.headline}>{t("ttkLobbyWaitHost")}</Text>
            </View>
          )}

          {host && (
            <>
              <SectionLabel>{t("ttkLobbyInvite")}</SectionLabel>
              {!account ? (
                <>
                  <Text style={[T.body, { marginBottom: 10 }]}>{t("ttkLobbySignIn")}</Text>
                  <SignInCard />
                </>
              ) : friends === null ? (
                <ActivityIndicator />
              ) : friends.length === 0 ? (
                <Text style={T.body}>{t("friendsEmpty")}</Text>
              ) : (
                <>
                  <Text style={[T.caption, { marginBottom: 8 }]}>{t("ttkLobbyInviteN")}</Text>
                  <Card style={{ paddingVertical: 4 }}>
                    {friends.map((f, i) => {
                      const inLobby = seats.some((s) => !s.host && s.nick === f.nick);
                      const sent = invited.has(f.code);
                      const full = seats.length >= MAX_HUMANS;
                      return (
                        <View key={f.code} style={[styles.row, i > 0 && styles.divider]}>
                          <View>
                            <Avatar id={f.avatar} size={40} frame={f.frame} />
                            <View style={[styles.dot, { backgroundColor: f.online ? C.green : "#C7CDC9" }]} />
                          </View>
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text style={styles.nick} numberOfLines={1}>
                              {f.nick || "—"}
                            </Text>
                            <RankChip level={f.level} compact size="sm" />
                          </View>
                          {inLobby ? (
                            <Text style={styles.state}>{t("ttkLobbyIn")}</Text>
                          ) : sent ? (
                            <Text style={styles.state}>{t("ttkLobbyInvited")}</Text>
                          ) : (
                            <Button
                              small
                              kind={f.online && !full ? "primary" : "secondary"}
                              icon="paperplane.fill"
                              title={f.online ? t("friendsInvite") : t("friendsOffline")}
                              disabled={!f.online || full}
                              onPress={() => invite(f)}
                            />
                          )}
                        </View>
                      );
                    })}
                  </Card>
                </>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: "center", backgroundColor: GAME.tt.bg, borderRadius: R.card, paddingVertical: 14, marginTop: 4 },
  code: { fontFamily: F.black, fontSize: 40, letterSpacing: 6, color: GAME.tt.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  nick: { flex: 1, fontFamily: F.display, fontSize: 19, color: C.text },
  hostChip: { backgroundColor: C.amberSoft, borderRadius: R.chip, paddingHorizontal: 10, paddingVertical: 3 },
  hostText: { fontWeight: "800", fontSize: 12, color: GAME.my.ink },
  emptySeat: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.border, alignItems: "center", justifyContent: "center" },
  waitHost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 18 },
  dot: { position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "white" },
  state: { fontWeight: "700", fontSize: 13, color: C.greenMid },
});
