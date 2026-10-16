import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SLICES } from "@/lib/taktik/rules";
import type { Lobby, MatchResult } from "@/lib/taktik/types";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { C, F, T } from "~/lib/theme";

import { Text } from "../Text";
import { Button, Icon } from "../ui";
import { ItemIcon } from "./Card";
import { MatchPitch } from "./MatchPitch";
import { TacticsChips } from "./TacticsCard";

/** one slice of the match; slow enough to follow the ball on the pitch */
const TICK_MS = 850;
const minute = (slice: number) => Math.round(((slice + 0.6) * 90) / SLICES);

/**
 * The round's matches: mine plays out slice by slice (~5 s, skippable) with
 * goals, saves and the shoot-out, then health lost / gold won and the rest of
 * the round's scores.
 */
export function MatchView({ lobby, meId, onClose }: { lobby: Lobby; meId: number; onClose: () => void }) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mine = lobby.last.find((r) => r.home === meId || r.away === meId);
  const others = lobby.last.filter((r) => r !== mine && r.away !== -1);
  const [shown, setShown] = useState(0);
  const done = shown >= SLICES;

  useEffect(() => {
    if (done) return;
    const id = setTimeout(() => setShown((s) => s + 1), TICK_MS);
    return () => clearTimeout(id);
  }, [shown, done]);

  // flip so "me" is always on the left
  const flip = !!mine && mine.away === meId;
  const side = (k: 0 | 1) => (flip ? ((1 - k) as 0 | 1) : k);
  const events = (mine?.events ?? []).filter((e) => e.slice < shown);
  const score: [number, number] = [0, 0];
  for (const e of events) if (e.kind === "goal") score[side(e.side)]++;

  const lastGoals = events.filter((e) => e.kind === "goal").length;
  const lastEvent = events[events.length - 1];
  const eventLabel = (k: string) => (k === "goal" ? t("ttkGoal") : k === "shield" ? t("ttkShield") : k === "save" ? t("ttkSave") : t("ttkMiss"));
  useEffect(() => {
    if (lastGoals === 0) return;
    haptic.press();
    play("pop");
  }, [lastGoals]);

  if (!mine) return null;
  const name = (id: number, fallback: string) => (id === -1 ? t("ttkFriendly") : (lobby.managers[id]?.name ?? fallback));
  const myName = lobby.managers[meId].name;
  const myCards = lobby.managers[meId].augments;
  const oppId = flip ? mine.home : mine.away;
  const theirCards = oppId >= 0 && !mine.awayName.endsWith("*") ? (lobby.managers[oppId]?.augments ?? []) : [];
  const theirName = mine.away === -1 ? t("ttkFriendly") : name(flip ? mine.home : mine.away, mine.awayName);
  const iWon = side(mine.winner) === 0;
  const pens = mine.pens ? [mine.pens[side(0)], mine.pens[side(1)]] : null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <StatusBar style="dark" />
      <View style={[styles.screen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        {/* scoreboard */}
        <View style={styles.board}>
          <Text style={styles.team} numberOfLines={1}>
            {myName}
          </Text>
          <Text style={styles.score}>
            {score[0]} – {score[1]}
          </Text>
          <Text style={[styles.team, { textAlign: "right" }]} numberOfLines={1}>
            {theirName}
          </Text>
        </View>
        <View style={styles.clock}>
          <Text style={styles.clockText}>{done ? "90'" : t("ttkMinute").replace("{m}", String(minute(Math.max(0, shown - 1))))}</Text>
        </View>

        {/* the match on a little pitch (prototype), me attacking left to right */}
        <View style={{ marginTop: 14 }}>
          <MatchPitch
            names={[myName, theirName]}
            mine={lobby.managers[meId].units}
            theirs={mine.away === -1 || mine.awayName.endsWith("*") ? null : (lobby.managers[flip ? mine.home : mine.away]?.units ?? null)}
            events={(mine.events ?? []).map((e) => ({ ...e, side: side(e.side) }))}
            shown={shown}
            over={done}
            sliceMs={TICK_MS}
            width={width - 32}
          />
        </View>

        {/* the tactics cards each side plays with */}
        {(myCards.length > 0 || theirCards.length > 0) && (
          <View style={styles.cards}>
            <View style={{ flex: 1 }}>
              <TacticsChips ids={myCards} />
            </View>
            <View style={{ flex: 1 }}>
              <TacticsChips ids={theirCards} align="flex-end" />
            </View>
          </View>
        )}

        {/* just the pitch: the last thing that happened under it, one line */}
        <View style={styles.lastSlot}>
          {lastEvent && (
            <Animated.View key={`${lastEvent.slice}-${lastEvent.kind}`} entering={FadeIn.duration(200)} style={[styles.event, lastEvent.kind === "goal" && styles.goal, { alignSelf: "center" }]}>
              <Text style={[styles.min, lastEvent.kind === "goal" && { color: "white" }]}>{`${minute(lastEvent.slice)}'`}</Text>
              <Icon name={lastEvent.kind === "goal" ? "soccerball" : lastEvent.kind === "shield" ? "xmark.shield.fill" : "hand.raised.fill"} size={14} color={lastEvent.kind === "goal" ? "white" : C.text2} fallback="⚽" />
              <Text style={[styles.eventText, lastEvent.kind === "goal" && { color: "white" }]} numberOfLines={1}>
                {eventLabel(lastEvent.kind)} · {lastEvent.name}
              </Text>
              <View style={[styles.sideDot, { backgroundColor: side(lastEvent.side) === 0 ? "#2563EB" : "#F43F5E" }]} />
            </Animated.View>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
          {done && (
            <Animated.View entering={ZoomIn.duration(260)} style={[styles.result, { backgroundColor: iWon ? C.greenSoft : C.redSoft }]}>
              {pens && (
                <Text style={[T.caption, { fontWeight: "700" }]}>
                  {t("ttkPens")} {pens[0]} – {pens[1]}
                </Text>
              )}
              <Text style={[styles.resultTitle, { color: iWon ? C.greenDark : C.red }]}>{iWon ? t("ttkWon") : t("ttkLost")}</Text>
              {!iWon && mine.damage > 0 && <Text style={[T.headline, { color: C.red }]}>{t("ttkDamage").replace("{n}", String(mine.damage))}</Text>}
              {mine.drops && (
                <View style={styles.drops}>
                  <Text style={T.headline}>{t("ttkDrop").replace("{g}", String(mine.drops.gold))}</Text>
                  {mine.drops.item && (
                    <View style={styles.dropItem}>
                      <ItemIcon id={mine.drops.item} size={28} />
                      <Text style={T.headline}>{t(`ttkI_${mine.drops.item}`)}</Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          )}

          {done && others.length > 0 && (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text style={[T.caption, { fontWeight: "700" }]}>{t("ttkOthers")}</Text>
              {others.map((r: MatchResult, i) => (
                <View key={i} style={styles.other}>
                  <Text style={[styles.otherName, r.winner === 0 && styles.otherWin]} numberOfLines={1}>
                    {name(r.home, "?")}
                  </Text>
                  <Text style={styles.otherScore}>
                    {r.goals[0]}–{r.goals[1]}
                    {r.pens ? "*" : ""}
                  </Text>
                  <Text style={[styles.otherName, { textAlign: "right" }, r.winner === 1 && styles.otherWin]} numberOfLines={1}>
                    {r.awayName.endsWith("*") ? `${r.awayName.slice(0, -1)} ${t("ttkGhost")}` : name(r.away, r.awayName)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {done ? <Button title={t("ttkContinue")} onPress={onClose} /> : <Button title={t("ttkSkip")} kind="secondary" icon="forward.fill" onPress={() => setShown(SLICES)} />}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
  board: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.greenDark, borderRadius: 18, padding: 14 },
  team: { flex: 1, fontFamily: F.display, fontSize: 18, color: "white" },
  score: { fontFamily: F.black, fontSize: 38, color: "white", fontVariant: ["tabular-nums"] },
  clock: { alignSelf: "center", marginTop: -10, backgroundColor: "#FACC15", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2 },
  clockText: { fontFamily: F.display, fontSize: 16, color: "#3B2A05" },
  cards: { flexDirection: "row", gap: 8, marginTop: 10 },
  lastSlot: { height: 44, justifyContent: "center", marginTop: 10 },
  sideDot: { width: 10, height: 10, borderRadius: 5 },
  event: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, maxWidth: "100%", backgroundColor: C.card },
  goal: { backgroundColor: C.green },
  min: { fontFamily: F.display, fontSize: 14, color: C.text3, minWidth: 26 },
  eventText: { fontSize: 14, fontWeight: "700", color: C.text, flexShrink: 1 },
  result: { marginTop: 10, borderRadius: 16, padding: 14, alignItems: "center", gap: 4 },
  resultTitle: { fontFamily: F.black, fontSize: 30 },
  drops: { alignItems: "center", gap: 6, marginTop: 4 },
  dropItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  other: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  otherName: { flex: 1, fontSize: 13, color: C.text2 },
  otherWin: { color: C.text, fontWeight: "800" },
  otherScore: { fontFamily: F.display, fontSize: 16, color: C.text, minWidth: 44, textAlign: "center" },
});
