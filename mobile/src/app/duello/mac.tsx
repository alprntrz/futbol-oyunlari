import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { dayNumber } from "@/lib/daily";
import { cardById, dailyRand, houseHand, PICK_SECONDS, questionKey, ROUNDS, statText, type Question } from "@/lib/duel";
import { XP } from "@/lib/levels";

import { FocusStatusBar } from "~/components/StadiumHeader";
import { DuelCardView } from "~/components/duel/DuelCardView";
import { EmoteButton, EmoteLayer, useEmotes } from "~/components/Emotes";
import { surname } from "~/components/taktik/Card";
import { Text } from "~/components/Text";
import { TourOverlay, useTour } from "~/components/Tour";
import { Button, Icon, Tap } from "~/components/ui";
import { saveDaily, useDuel } from "~/lib/duel";
import { useRecordMatch } from "~/lib/history";
import { GAME_ICON, useLivePush, useMatchActivity } from "~/lib/liveActivity";
import { REVEAL_MS, useLocalDuel, useOnlineDuel, type DuelMatch, type RoundResult } from "~/lib/duelMatch";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { randomNick } from "~/lib/nick";
import { play } from "~/lib/sound";
import { C, F, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

type Mode = "daily" | "practice" | "bot" | "room";

/**
 * A Card Duel match. `mode`: daily (seeded house player, once a day), practice
 * (house player, practice XP), bot (the random-opponent fallback), room (online, `code`).
 */
export default function DuelMatchScreen() {
  const params = useLocalSearchParams<{ mode?: Mode; code?: string; nick?: string }>();
  const mode: Mode = params.mode ?? "practice";
  const { hand, theme } = useDuel();
  if (hand.length === 0) return <View style={{ flex: 1, backgroundColor: BG }} />;
  return mode === "room" && params.code ? <Online code={params.code} hand={hand} /> : <Local mode={mode} hand={hand} nick={params.nick} themeId={theme.id} />;
}

function Local({ mode, hand, nick, themeId }: { mode: Mode; hand: number[]; nick?: string; themeId: string }) {
  const day = dayNumber();
  const { theme } = useDuel();
  const [opponent] = useState(() => nick || randomNick());
  const [house] = useState(() => houseHand(theme, mode === "daily" ? dailyRand(day) : Math.random));
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const m = useLocalDuel(hand, house, mode === "daily" ? day : null);
  const [game, setGame] = useState(0);
  useEffect(() => {
    if (mode === "daily" && m.over) saveDaily(m.score[0], m.score[1]);
  }, [mode, m.over, m.score]);
  return (
    <Board
      m={m}
      hand={hand}
      opponent={opponent}
      xpKey={mode === "daily" ? `dz-daily-${day}` : `dz-${mode}-${seed}-${game}-${themeId}`}
      practice={mode === "practice"}
      daily={mode === "daily"}
      onAgain={
        mode === "daily"
          ? undefined
          : () => {
              setGame(game + 1);
              m.again();
            }
      }
    />
  );
}

function Online({ code, hand }: { code: string; hand: number[] }) {
  const m = useOnlineDuel(code);
  useLivePush("dz", code);
  return <Board m={m} hand={hand} opponent={m.opponent} xpKey={`dz-room-${code}-${m.game}`} online onAgain={m.peerLeft ? undefined : m.again} />;
}

const BG = "#0E3B22";

function Board({
  m,
  hand,
  opponent,
  xpKey,
  practice,
  daily,
  online = false,
  onAgain,
}: {
  m: DuelMatch;
  online?: boolean;
  hand: number[];
  opponent: string | null;
  xpKey: string;
  practice?: boolean;
  daily?: boolean;
  onAgain?: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());
  const emotes = useEmotes("dz", online);
  // first match: the question, the cards in hand, the score
  const tour = useTour("duel-match-v1", [
    { target: "question", title: t("dzTour5T"), body: t("dzTour5") },
    { target: "hand", title: t("dzTour6T"), body: t("dzTour6") },
    { target: "score", title: t("dzTour7T"), body: t("dzTour7") },
  ], !online);
  // the walkthrough freezes the pick clock (house matches; online ones don't show it)
  const touring = tour.step !== null;
  useEffect(() => {
    m.hold?.(touring);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touring]);
  // the result card for this game (xpKey changes every game) once the last reveal has been seen
  const [endShownFor, setEndShownFor] = useState<string | null>(null);
  const showEnd = m.over && endShownFor === xpKey;

  // the clock ticks while a pick is open
  useEffect(() => {
    if (!m.deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [m.deadline]);

  // a round just revealed: sound and buzz
  const last = m.results[m.results.length - 1];
  useEffect(() => {
    if (!last) return;
    if (last.winner === "me") {
      haptic.success();
      play("pop");
    } else if (last.winner === "them") haptic.error();
    else haptic.tap();
  }, [m.results.length, last]);

  // the last reveal stays up for a moment before the result card
  useEffect(() => {
    if (!m.over) return;
    const id = setTimeout(() => setEndShownFor(xpKey), REVEAL_MS);
    return () => clearTimeout(id);
  }, [m.over, xpKey]);

  const [mine, theirs] = m.score;
  const outcome = mine === theirs ? "draw" : mine > theirs ? "win" : "lose";
  const xp = (outcome === "win" ? XP.dzWin : outcome === "draw" ? XP.dzDraw : XP.dzLoss) + (daily ? XP.dzDaily : 0);
  useRecordMatch(showEnd && !practice, {
    key: xpKey,
    game: "dz",
    opponent: opponent ?? t("opponent"),
    result: outcome === "win" ? "win" : outcome === "lose" ? "loss" : "draw",
    score: `${mine}–${theirs}`,
  });
  // paid once the result card is up; only a win gets the full reward screen, the rest a "+XP" toast
  useXpAward(showEnd, xpKey, "dz", xp, {
    practice,
    title: t("dzWon"),
    stats: practice || outcome !== "win" ? undefined : [{ label: t("dzName"), value: `${mine}–${theirs}`, tone: "green" }],
  });

  // Lock Screen / Dynamic Island: round, score, the pick clock (iOS draws it)
  const roundNo = Math.min(ROUNDS, m.round + (m.deadline ? 1 : 0));
  useMatchActivity(
    m.round === 0 && !m.deadline
      ? null
      : {
          game: t("dzName"),
          icon: GAME_ICON.dz,
          headline: m.over
            ? t(outcome === "win" ? "liveWon" : outcome === "draw" ? "liveDraw" : "liveLost")
            : m.deadline
              ? m.myPick === null
                ? t("dzPick")
                : t("dzWaiting")
              : last
                ? t(last.winner === "me" ? "dzWinRound" : last.winner === "them" ? "dzLoseRound" : "dzDrawRound")
                : t("dzPick"),
          tone: m.over ? (outcome === "lose" ? "lose" : outcome) : m.deadline ? (m.myPick === null ? "X" : "O") : last?.winner === "me" ? "win" : last?.winner === "them" ? "lose" : "draw",
          line: `${t("dzRound").replace("{n}", String(Math.max(1, roundNo))).replace("{max}", String(ROUNDS))} · ${t("you")} – ${opponent ?? "…"}`,
          score: `${mine} – ${theirs}`,
          mark: "",
          endsAt: m.deadline ? Math.round(m.deadline / 1000) * 1000 : 0,
          since: m.deadline ? Math.round((m.deadline - PICK_SECONDS * 1000) / 1000) * 1000 : 0,
          phase: m.over ? "over" : m.deadline ? "turn" : "pause",
        }
  );

  const revealing = !!last && !m.deadline && (m.over ? !showEnd : true) && m.results.length > 0;
  const shownQuestion: Question | null = revealing ? last.question : m.question;
  const secondsLeft = m.heldMs != null ? Math.ceil(m.heldMs / 1000) : m.deadline ? Math.max(0, Math.ceil((m.deadline - now) / 1000)) : 0;
  const used = new Set(m.results.map((r) => r.mine));
  const cardW = Math.min(84, (width - 32 - 3 * 8) / 4);
  const bigW = Math.min(130, width * 0.3);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 8 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="light" />

      {/* top: back, round, score */}
      <View style={styles.topRow}>
        <Tap onPress={() => router.back()} style={styles.back} accessibilityLabel="‹">
          <Icon name="chevron.left" size={18} color="white" fallback="‹" />
        </Tap>
        <Text style={styles.round}>{t("dzRound").replace("{n}", String(Math.min(ROUNDS, m.round + (revealing ? 0 : 1)))).replace("{max}", String(ROUNDS))}</Text>
        <EmoteButton e={emotes} />
      </View>
      <View ref={tour.ref("score")} collapsable={false} style={styles.scoreRow}>
        <Text style={styles.nick} numberOfLines={1}>
          {t("you")}
        </Text>
        <Text style={styles.score}>
          {mine} – {theirs}
        </Text>
        <Text style={[styles.nick, { textAlign: "right" }]} numberOfLines={1}>
          {opponent ?? "…"}
        </Text>
      </View>
      {/* round track */}
      <View style={styles.track}>
        {Array.from({ length: ROUNDS }, (_, i) => {
          const r = m.results[i];
          return <View key={i} style={[styles.dot, r && { backgroundColor: r.winner === "me" ? C.green : r.winner === "them" ? C.red : "#E3A008" }]} />;
        })}
      </View>

      {/* question */}
      {shownQuestion && (
        <Animated.View ref={tour.ref("question") as never} collapsable={false} key={`${m.round}-${revealing}`} entering={FadeIn.duration(200)} style={[styles.question, shownQuestion.lower && styles.questionLow]}>
          <Text style={[styles.questionText, shownQuestion.lower && { color: "white" }]}>{t(questionKey(shownQuestion))}</Text>
          {shownQuestion.lower && <Text style={styles.lowerTag}>{t("dzLowerWins")}</Text>}
          {!!m.deadline && (
            <View style={styles.clockBar}>
              <View style={[styles.clockFill, { width: `${(secondsLeft / PICK_SECONDS) * 100}%` }, secondsLeft <= 5 && { backgroundColor: C.red }]} />
            </View>
          )}
        </Animated.View>
      )}

      {/* the face-off */}
      <View style={styles.arena}>
        {revealing ? (
          <Reveal r={last} width={bigW} />
        ) : (
          <>
            {m.myPick !== null && m.myPick >= 0 ? <DuelCardView card={cardById(m.myPick) ?? null} width={bigW} /> : <View style={[styles.slot, { width: bigW, height: bigW * 1.36 }]} />}
            <Text style={styles.vs}>VS</Text>
            {m.theyPicked ? <DuelCardView card={null} back width={bigW} /> : <View style={[styles.slot, { width: bigW, height: bigW * 1.36 }]} />}
          </>
        )}
      </View>
      <Text style={styles.hint}>{m.peerLeft ? t("dzPeerLeft") : m.deadline ? (m.myPick === null ? t("dzPick") : !m.theyPicked ? t("dzWaiting") : "") : ""}</Text>

      {/* my hand */}
      <View ref={tour.ref("hand")} collapsable={false} style={styles.hand}>
        {hand.map((id) => (
          <DuelCardView
            key={id}
            card={cardById(id) ?? null}
            width={cardW}
            used={used.has(id)}
            selected={m.myPick === id}
            onPress={m.deadline && m.myPick === null ? () => (haptic.tap(), m.pick(id)) : undefined}
          />
        ))}
      </View>

      <EmoteLayer e={emotes} top={insets.top + 44} />
      {!showEnd && <TourOverlay tour={tour} />}

      {showEnd && (
        <View style={[StyleSheet.absoluteFill, styles.backdrop]}>
          <Animated.View entering={ZoomIn.duration(240)} style={[styles.end, { marginTop: insets.top + 40, marginBottom: insets.bottom + 20 }]}>
            <Text style={[styles.endTitle, { color: outcome === "win" ? C.greenDark : outcome === "lose" ? C.red : "#B7791F" }]}>
              {t(outcome === "win" ? "dzWon" : outcome === "draw" ? "dzDraw" : "dzLost")}
            </Text>
            <Text style={styles.endScore}>
              {mine} – {theirs}
            </Text>
            <Text style={[T.caption, { fontWeight: "700", marginTop: 8 }]}>{t("dzBreakdown")}</Text>
            <ScrollView style={{ alignSelf: "stretch", flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingVertical: 6 }}>
              {m.results.map((r, i) => (
                <BreakdownRow key={i} r={r} n={i + 1} />
              ))}
            </ScrollView>
            <View style={{ alignSelf: "stretch", gap: 8, marginTop: 8 }}>
              {onAgain && <Button title={t(practice ? "dzAgain" : "dzRematch")} icon="arrow.clockwise" onPress={onAgain} />}
              <Button title={t("close")} kind="secondary" onPress={() => router.back()} />
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

function Reveal({ r, width }: { r: RoundResult; width: number }) {
  const { t } = useI18n();
  const a = cardById(r.mine);
  const b = cardById(r.theirs);
  const v = (id: number) => statText(r.question.stat, cardById(id)?.stats[r.question.stat] ?? 0);
  return (
    <>
      <Animated.View entering={ZoomIn.duration(220)}>
        <DuelCardView card={a ?? null} width={width} value={v(r.mine)} result={r.winner === "me" ? "win" : r.winner === "them" ? "lose" : "draw"} />
      </Animated.View>
      <View style={[styles.verdict, { backgroundColor: r.winner === "me" ? C.green : r.winner === "them" ? C.red : "#E3A008" }]}>
        <Text style={styles.verdictText}>{t(r.winner === "me" ? "dzWinRound" : r.winner === "them" ? "dzLoseRound" : "dzDrawRound")}</Text>
      </View>
      <Animated.View entering={ZoomIn.duration(220).delay(120)}>
        <DuelCardView card={b ?? null} width={width} value={v(r.theirs)} result={r.winner === "them" ? "win" : r.winner === "me" ? "lose" : "draw"} />
      </Animated.View>
    </>
  );
}

function BreakdownRow({ r, n }: { r: RoundResult; n: number }) {
  const { t } = useI18n();
  const a = cardById(r.mine);
  const b = cardById(r.theirs);
  const v = (id: number) => statText(r.question.stat, cardById(id)?.stats[r.question.stat] ?? 0);
  const tone = r.winner === "me" ? C.green : r.winner === "them" ? C.red : "#E3A008";
  return (
    <View style={[styles.bRow, { borderLeftColor: tone }]}>
      <Text style={styles.bN}>{n}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.bStat}>
          {t(`dzS_${r.question.stat}`)}
          {r.question.lower ? " ↓" : ""}
        </Text>
        <Text style={styles.bNames} numberOfLines={1}>
          {surname(a?.name ?? "?")} {v(r.mine)} · {surname(b?.name ?? "?")} {v(r.theirs)}
        </Text>
      </View>
      <View style={[styles.bBadge, { backgroundColor: tone }]}>
        <Text style={styles.bBadgeText}>{r.winner === "me" ? "W" : r.winner === "them" ? "L" : "D"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  round: { fontFamily: F.display, fontSize: 20, color: "white" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  nick: { flex: 1, fontFamily: F.display, fontSize: 16, color: "white" },
  score: { fontFamily: F.black, fontSize: 28, color: "white", fontVariant: ["tabular-nums"] },
  track: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 8 },
  dot: { width: 22, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.18)" },
  question: { marginTop: 12, backgroundColor: "white", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, alignItems: "center" },
  questionLow: { backgroundColor: "#C2333F" },
  questionText: { fontFamily: F.display, fontSize: 19, color: C.text, textAlign: "center" },
  lowerTag: { marginTop: 2, color: "white", fontWeight: "800", fontSize: 12, opacity: 0.9 },
  clockBar: { alignSelf: "stretch", height: 5, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.12)", marginTop: 10, overflow: "hidden" },
  clockFill: { height: 5, borderRadius: 3, backgroundColor: C.green },
  arena: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  slot: { borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.25)" },
  vs: { fontFamily: F.black, fontSize: 20, color: "rgba(255,255,255,0.6)" },
  verdict: { position: "absolute", alignSelf: "center", top: "44%", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, zIndex: 2 },
  verdictText: { color: "white", fontFamily: F.display, fontSize: 15 },
  hint: { textAlign: "center", color: "rgba(255,255,255,0.75)", fontWeight: "700", minHeight: 22, marginBottom: 6 },
  hand: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  backdrop: { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 20 },
  end: { maxHeight: "92%", backgroundColor: C.bg, borderRadius: 22, padding: 18, alignItems: "center" },
  endTitle: { fontFamily: F.black, fontSize: 32 },
  endScore: { fontFamily: F.black, fontSize: 44, color: C.text },
  bRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, borderLeftWidth: 4 },
  bN: { fontFamily: F.display, fontSize: 16, color: C.text3, width: 16, textAlign: "center" },
  bStat: { fontFamily: F.display, fontSize: 14, color: C.text },
  bNames: { fontSize: 13, color: C.text2 },
  bBadge: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  bBadgeText: { color: "white", fontFamily: F.display, fontSize: 14 },
});
