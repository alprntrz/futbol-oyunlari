import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Modal, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SLICES } from "@/lib/taktik/rules";
import type { Lobby, MatchResult } from "@/lib/taktik/types";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { play } from "~/lib/sound";
import { C, F, R, shadow, T } from "~/lib/theme";

import { Text } from "../Text";
import { Button, Icon } from "../ui";
import { ItemIcon, surname } from "./Card";
import { MatchPitch, PITCH_RATIO, SIDE } from "./MatchPitch";
import { TacticsChips } from "./TacticsCard";

/** one slice of the match; slow enough to follow the ball on the pitch */
const TICK_MS = 850;
const KICKOFF_MS = 1600;
const RESULT_MS = 1600;
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
  /** height left for the pitch */
  const [area, setArea] = useState(0);
  const done = shown >= SLICES;

  useEffect(() => {
    if (done) return;
    // the kick-off badge stays a moment before the first move
    const id = setTimeout(() => setShown((s) => s + 1), shown === 0 ? KICKOFF_MS : TICK_MS);
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

  // full time: the result stays a moment, then it's back to the board by itself (a tap goes sooner)
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(onClose, RESULT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (!mine) return null;
  const name = (id: number, fallback: string) => (id === -1 ? t("ttkFriendly") : (lobby.managers[id]?.name ?? fallback));
  const myName = lobby.managers[meId].name;
  const myCards = lobby.managers[meId].augments;
  const oppId = flip ? mine.home : mine.away;
  const theirCards = oppId >= 0 && !mine.awayName.endsWith("*") ? (lobby.managers[oppId]?.augments ?? []) : [];
  const theirName = mine.away === -1 ? t("ttkFriendly") : name(flip ? mine.home : mine.away, mine.awayName);
  const iWon = side(mine.winner) === 0;
  const pens = mine.pens ? [mine.pens[side(0)], mine.pens[side(1)]] : null;

  // the man of the match: my top scorer, else my best player on the pitch
  const myGoals = new Map<string, number>();
  for (const e of mine.events ?? []) if (e.kind === "goal" && side(e.side) === 0) myGoals.set(e.name, (myGoals.get(e.name) ?? 0) + 1);
  const motmName = [...myGoals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const myUnits = lobby.managers[meId].units.filter((u) => u.slot !== null);
  const motm = (motmName && myUnits.find((u) => u.name === motmName)) || [...myUnits].sort((a, b) => b.cost * b.star - a.cost * a.star)[0];
  const pitchW = Math.max(200, Math.min(width - 24, area / PITCH_RATIO));

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <StatusBar style="dark" />
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        {/* scoreboard: my name, the score and the minute, theirs */}
        <View style={styles.board}>
          <View style={[styles.namePill, { backgroundColor: SIDE.home }]}>
            <Text style={styles.nameText} numberOfLines={1}>
              {myName}
            </Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.score}>
              {score[0]} – {score[1]}
            </Text>
            <View style={styles.clock}>
              <Text style={styles.clockText}>{done ? t("ttkFullTime") : t("ttkMinute").replace("{m}", String(shown === 0 ? 0 : minute(shown - 1)))}</Text>
            </View>
          </View>
          <View style={[styles.namePill, { backgroundColor: SIDE.away }]}>
            <Text style={styles.nameText} numberOfLines={1}>
              {theirName}
            </Text>
          </View>
        </View>

        {/* the full pitch: me below attacking up, them above */}
        <View style={{ flex: 1, marginTop: 8, justifyContent: "center" }} onLayout={(e) => setArea(e.nativeEvent.layout.height)}>
          {area > 0 && (
            <View style={{ alignSelf: "center" }}>
              <MatchPitch
                mine={lobby.managers[meId].units}
                theirs={mine.away === -1 || mine.awayName.endsWith("*") ? null : (lobby.managers[flip ? mine.home : mine.away]?.units ?? null)}
                events={(mine.events ?? []).map((e) => ({ ...e, side: side(e.side) }))}
                shown={shown}
                over={done}
                sliceMs={TICK_MS}
                width={pitchW}
              />
              {/* kick-off */}
              {shown === 0 && (
                <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(220)} style={styles.kickoff} pointerEvents="none">
                  <Text style={styles.kickoffTitle}>{t("ttkKickoff")}</Text>
                  <Text style={styles.kickoffSub} numberOfLines={1}>
                    {myName} – {theirName}
                  </Text>
                </Animated.View>
              )}
              {/* full time: the result over the lower half */}
              {done && (
                <Animated.View entering={FadeIn.duration(260)} style={[styles.result, { width: pitchW * 0.84 }]} onTouchEnd={onClose}>
                  {pens && (
                    <Text style={[T.caption, { fontWeight: "700" }]}>
                      {t("ttkPens")} {pens[0]} – {pens[1]}
                    </Text>
                  )}
                  <Text style={[styles.resultTitle, { color: iWon ? C.greenMid : C.red }]}>{iWon ? t("ttkWon") : t("ttkLost")}</Text>
                  <Text style={styles.resultScore}>
                    {score[0]} – {score[1]}
                  </Text>
                  {!iWon && mine.damage > 0 && <Text style={[T.headline, { color: C.red }]}>{t("ttkDamage").replace("{n}", String(mine.damage))}</Text>}
                  {mine.drops && (
                    <View style={styles.drops}>
                      <Text style={T.headline}>{t("ttkDrop").replace("{g}", String(mine.drops.gold))}</Text>
                      {mine.drops.item && (
                        <View style={styles.dropItem}>
                          <ItemIcon id={mine.drops.item} size={24} />
                          <Text style={T.headline}>{t(`ttkI_${mine.drops.item}`)}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {motm && <Text style={styles.motm}>{t("ttkMotm").replace("{name}", surname(motm.name))}</Text>}
                  {others.length > 0 && (
                    <View style={styles.others}>
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
                </Animated.View>
              )}
            </View>
          )}
        </View>

        {/* the last thing that happened, one line */}
        <View style={styles.lastSlot}>
          {lastEvent && !done && (
            <Animated.View key={`${lastEvent.slice}-${lastEvent.kind}`} entering={FadeIn.duration(200)} style={[styles.event, lastEvent.kind === "goal" && styles.goal]}>
              <Text style={[styles.min, lastEvent.kind === "goal" && { color: "white" }]}>{`${minute(lastEvent.slice)}'`}</Text>
              <Icon name={lastEvent.kind === "goal" ? "soccerball" : lastEvent.kind === "shield" ? "xmark.shield.fill" : "hand.raised.fill"} size={14} color={lastEvent.kind === "goal" ? "white" : C.text2} fallback="⚽" />
              <Text style={[styles.eventText, lastEvent.kind === "goal" && { color: "white" }]} numberOfLines={1}>
                {eventLabel(lastEvent.kind)} · {surname(lastEvent.name)}
              </Text>
              <View style={[styles.sideDot, { backgroundColor: side(lastEvent.side) === 0 ? SIDE.home : SIDE.away }]} />
            </Animated.View>
          )}
        </View>

        {/* each side's tactics cards */}
        <View style={styles.cards}>
          <View style={[styles.cardCol, { borderLeftColor: SIDE.home }]}>
            <Text style={styles.cardHead}>{t("ttkYou")}</Text>
            {myCards.length > 0 ? <TacticsChips ids={myCards} /> : <Text style={T.caption}>–</Text>}
          </View>
          <View style={[styles.cardCol, { borderLeftColor: SIDE.away }]}>
            <Text style={styles.cardHead}>{t("ttkThem")}</Text>
            {theirCards.length > 0 ? <TacticsChips ids={theirCards} /> : <Text style={T.caption}>–</Text>}
          </View>
        </View>

        {!done && (
          <View style={styles.skip}>
            <Button small kind="secondary" icon="forward.fill" title={t("ttkSkip")} onPress={() => setShown(SLICES)} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 12 },
  board: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  namePill: { flex: 1, borderRadius: R.inner, paddingVertical: 6, paddingHorizontal: 8, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "rgba(0,0,0,0.22)" },
  nameText: { fontFamily: F.display, fontSize: 17, color: "white" },
  score: { fontFamily: F.black, fontSize: 34, lineHeight: 36, color: C.text, fontVariant: ["tabular-nums"] },
  clock: { backgroundColor: "#FACC15", borderRadius: R.chip, paddingHorizontal: 9, marginTop: -2 },
  clockText: { fontFamily: F.display, fontSize: 13, color: "#3B2A05" },
  kickoff: { position: "absolute", alignSelf: "center", top: "42%", backgroundColor: C.card, borderRadius: R.card, paddingHorizontal: 22, paddingVertical: 12, alignItems: "center", ...shadow },
  kickoffTitle: { fontFamily: F.black, fontSize: 26, color: C.text },
  kickoffSub: { fontFamily: F.display, fontSize: 14, color: C.text2 },
  result: { position: "absolute", alignSelf: "center", bottom: "6%", backgroundColor: C.card, borderRadius: R.card, padding: 16, alignItems: "center", gap: 3, ...shadow },
  resultTitle: { fontFamily: F.black, fontSize: 36, lineHeight: 38 },
  resultScore: { fontFamily: F.black, fontSize: 26, color: C.text },
  motm: { fontFamily: F.display, fontSize: 15, color: C.text, marginTop: 2 },
  drops: { alignItems: "center", gap: 4 },
  dropItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  others: { alignSelf: "stretch", gap: 2, marginTop: 4 },
  other: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  otherName: { flex: 1, fontSize: 12, color: C.text2 },
  otherWin: { color: C.text, fontWeight: "800" },
  otherScore: { fontFamily: F.display, fontSize: 14, color: C.text, minWidth: 40, textAlign: "center" },
  lastSlot: { height: 40, justifyContent: "center", marginTop: 6 },
  event: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, paddingHorizontal: 14, borderRadius: R.chip, maxWidth: "100%", backgroundColor: C.card, ...shadow },
  goal: { backgroundColor: C.green },
  min: { fontFamily: F.display, fontSize: 14, color: C.text3 },
  eventText: { fontFamily: F.display, fontSize: 16, color: C.text, flexShrink: 1 },
  sideDot: { width: 9, height: 9, borderRadius: 5 },
  cards: { flexDirection: "row", gap: 10, marginTop: 4 },
  cardCol: { flex: 1, gap: 4, borderLeftWidth: 3, paddingLeft: 8 },
  skip: { alignSelf: "center", height: 40, marginTop: 8 },
  cardHead: { fontFamily: F.display, fontSize: 16, color: C.text },
});
