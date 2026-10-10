import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, FadeOutUp, Keyframe, SlideInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { quizQuestions, type QuizCategory } from "@/lib/quiz";

import { GrassPattern } from "~/components/GrassPattern";
import { Confetti } from "~/components/motion";
import { LevelProgress, type QuizProfile } from "~/components/QuizLevel";
import { RunningPlayer } from "~/components/RunningPlayer";
import { goBack, NIGHT, StadiumHeader, NightStatusBar, type Runner } from "~/components/StadiumHeader";
import { Text } from "~/components/Text";
import { Icon, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadNick, loadPlayerId } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { C, F } from "~/lib/theme";

type L = { tr: string; en: string };
interface QzPlayer {
  id: string;
  nick: string;
  score: number;
  answered: boolean;
  choice: number | null;
  gained: number;
}
interface QzRoom {
  code: string;
  random: boolean;
  hostId: string;
  settings: { seconds: number; maxPlayers: number; category: QuizCategory };
  phase: "lobby" | "intro" | "question" | "reveal" | "done";
  index: number;
  total: number;
  question: { text: L; context: L | null; options: L[] } | null;
  answer: number | null;
  remainingMs: number;
  players: QzPlayer[];
}

const HEADER = 150;
// on the light pitch: the app's own green and red, with white text on them
const RIGHT = NIGHT.light ? C.green : "#4ADE80";
const WRONG = NIGHT.light ? "#E5484D" : "#F87171";
/** your pick before the reveal: dark green, so it never reads as "right" */
const PICKED = NIGHT.light ? C.greenDark : NIGHT.accent;

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 50%, 45%)`;
}

function Avatar({ name, size = 30, ring = "white" }: { name: string; size?: number; ring?: string }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name), borderColor: ring }]}>
      <Text allowFontScaling={false} style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

/*
 * Motion, taken from the reference recording:
 * - the question card stays put; its text fades out and the next one fades in
 * - options leave bottom-up, one after another, and arrive top-down the same way
 * - picks land on the options as small avatars; points float up from your option
 * - at full time the board lifts away and the podium springs up from below
 */
const OPTION_IN = (i: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.94 }] },
    100: { opacity: 1, transform: [{ scale: 1 }] },
  })
    .delay(430 + i * 95)
    .duration(230);
const OPTION_OUT = (i: number) => FadeOut.delay((3 - i) * 70).duration(160);
const TEXT_IN = FadeIn.delay(360).duration(260);
const TEXT_OUT = FadeOut.duration(150);
const POINTS_UP = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 8 }, { scale: 0.8 }] },
  25: { opacity: 1, transform: [{ translateY: -6 }, { scale: 1.1 }] },
  80: { opacity: 1, transform: [{ translateY: -18 }, { scale: 1 }] },
  100: { opacity: 0, transform: [{ translateY: -26 }, { scale: 1 }] },
}).duration(1400);

/** Countdown ring, like a stopwatch face. */
function TimerRing({ fraction, seconds, low }: { fraction: number; seconds: number; low: boolean }) {
  const r = 17;
  const len = 2 * Math.PI * r;
  return (
    <View style={styles.ring}>
      <Svg width={44} height={44} style={StyleSheet.absoluteFill}>
        <Circle cx={22} cy={22} r={r} stroke={NIGHT.line} strokeWidth={4} fill="none" />
        <Circle
          cx={22}
          cy={22}
          r={r}
          stroke={low ? WRONG : NIGHT.track}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len}`}
          strokeDashoffset={len * (1 - fraction)}
          transform="rotate(-90 22 22)"
        />
      </Svg>
      <Text allowFontScaling={false} style={[styles.ringText, low && { color: WRONG }]}>
        {seconds}
      </Text>
    </View>
  );
}

/** One quiz room, from the waiting list through the questions to the podium. */
export default function QuizRoom() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code: string; random?: string }>();
  const code = (params.code ?? "").toUpperCase();
  const [room, setRoom] = useState<QzRoom | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [myId, setMyId] = useState(() => getSocket().id ?? "");
  const [picked, setPicked] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const lastPhase = useRef("");
  const [progress, setProgress] = useState<{ gained: number; before: QuizProfile; after: QuizProfile } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: QzRoom) => {
      setRoom(r);
      setDeadline(Date.now() + r.remainingMs);
      const key = `${r.phase}-${r.index}`;
      if (key === lastPhase.current) return;
      lastPhase.current = key;
      if (r.phase === "question") setPicked(null);
      if (r.phase === "intro") setProgress(null);
      if (r.phase === "reveal") {
        const me = r.players.find((p) => p.id === socket.id);
        if (me?.choice === r.answer) haptic.success();
        else haptic.error();
      }
      if (r.phase === "done" && [...r.players].sort((a, b) => b.score - a.score)[0]?.id === socket.id) setConfetti(Date.now());
    };
    const onConnect = () => setMyId(socket.id ?? "");
    const onProgress = (p: { gained: number; before: QuizProfile; after: QuizProfile }) => {
      setProgress(p);
      if (p.after.level > p.before.level) setTimeout(() => haptic.success(), 1100);
    };
    socket.on("qz:progress", onProgress);
    socket.on("qz:update", apply);
    socket.on("connect", onConnect);
    Promise.all([loadNick(), loadPlayerId()]).then(([nick, pid]) =>
      socket.emit("qz:join", { code, nick, pid }, (res: { ok: boolean; error?: string; room?: QzRoom }) => {
        if (res.ok && res.room) apply(res.room);
        else setError(res.error === "full" ? t("roomFull") : res.error === "started" ? t("qzRoomStarted") : t("roomNotFound"));
      })
    );
    return () => {
      socket.emit("qz:leave");
      socket.off("qz:progress", onProgress);
      socket.off("qz:update", apply);
      socket.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const ticking = room?.phase === "question" || room?.phase === "intro" || room?.phase === "reveal";
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [ticking]);

  const tx = (l: L) => (locale === "tr" ? l.tr : l.en);
  const me = room?.players.find((p) => p.id === myId);
  const nameOf = (p: QzPlayer) => (p.id === myId ? t("you") : p.nick || t("opponent"));
  const standings = room ? [...room.players].sort((a, b) => b.score - a.score) : [];
  const maxScore = (room?.total ?? 10) * 10;
  const runners: Runner[] | undefined =
    room && room.phase !== "done"
      ? room.players.map((p) => ({
          id: p.id,
          name: p.nick || "?",
          color: avatarColor(p.nick || "?"),
          progress: Math.min(1, p.score / maxScore),
          label: room.phase === "lobby" ? undefined : String(p.score),
          me: p.id === myId,
        }))
      : undefined;

  const leave = (
    <Pressable onPress={() => goBack()} style={[styles.leave, { top: insets.top + 6 }]} accessibilityRole="button" accessibilityLabel={t("close")} hitSlop={8}>
      <Icon name="chevron.left" size={18} color={NIGHT.ink} fallback="‹" />
    </Pressable>
  );

  let body: React.ReactNode = null;

  if (error) {
    body = (
      <View style={[styles.card, { alignItems: "center", gap: 12, paddingVertical: 28 }]}>
        <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
        <Text style={styles.cardTitle}>{error}</Text>
        <WideButton title={t("close")} kind="ghost" onPress={() => goBack()} />
      </View>
    );
  } else if (room?.phase === "lobby") {
    const isHost = room.hostId === myId;
    const copy = async () => {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    body = (
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24, gap: 14 }} showsVerticalScrollIndicator={false}>
        {room.random ? (
          <Animated.View entering={FadeIn.duration(250)} style={{ alignItems: "center", gap: 6, paddingVertical: 8 }}>
            <RunningPlayer shirt={NIGHT.kit.shirt} shorts={NIGHT.kit.shorts} />
            <Text style={styles.big}>{t("qzSearching")}</Text>
            <Text style={styles.sub}>{t("qzSearchingDesc")}</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={[styles.card, { alignItems: "center", gap: 10 }]}>
            <Text style={styles.caption}>{t("roomCode")}</Text>
            <Tap onPress={copy} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`${t("roomCode")} ${code.split("").join(" ")}`}>
              <Text style={styles.code}>{code}</Text>
              <Icon name={copied ? "checkmark.circle.fill" : "doc.on.doc"} size={20} color={copied ? C.green : C.text3} fallback="⧉" />
            </Tap>
            <Text style={styles.caption}>
              {room.total} {t("qzSummary")}, {room.settings.seconds} {t("qzSecShort")}, {room.settings.maxPlayers} {t("qzMaxPlayers")}
            </Text>
            <WideButton title={t("shareCode")} kind="ghost" icon="square.and.arrow.up" onPress={() => Share.share({ message: `${t("qzInvite")} ${code}` })} />
          </Animated.View>
        )}
        <View style={styles.seats}>
          {Array.from({ length: room.settings.maxPlayers }, (_, i) => {
            const p = room.players[i];
            return p ? (
              <Animated.View key={p.id} entering={ZoomIn.duration(220)} style={styles.seat}>
                <Avatar name={p.nick || "?"} size={46} ring={p.id === myId ? NIGHT.accent : "white"} />
                <Text style={styles.seatName} numberOfLines={1}>
                  {nameOf(p)}
                </Text>
              </Animated.View>
            ) : (
              <View key={`empty-${i}`} style={styles.seat}>
                <View style={styles.emptySeat} />
                <Text style={[styles.seatName, { opacity: 0.4 }]}> </Text>
              </View>
            );
          })}
        </View>
        {!room.random &&
          (isHost ? (
            <>
              <WideButton title={t("start")} icon="play.fill" disabled={room.players.length < 2} onPress={() => getSocket().emit("qz:start")} />
              {room.players.length < 2 && <Text style={[styles.sub, { textAlign: "center" }]}>{t("qzStartNeeds")}</Text>}
            </>
          ) : (
            <Text style={[styles.sub, { textAlign: "center" }]}>{t("waitingHost")}</Text>
          ))}
      </ScrollView>
    );
  } else if (room?.phase === "intro") {
    body = (
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(200)} style={{ alignItems: "center", paddingTop: 30, gap: 10 }}>
        <Animated.View entering={ZoomIn.duration(260)}>
          <Text style={[styles.big, { fontSize: 44, lineHeight: 48 }]}>{t("qzGetReady")}</Text>
        </Animated.View>
        <Text style={styles.sub}>
          {room.total} {t("qzSummary")}, {room.settings.seconds} {t("qzSecShort")}
        </Text>
        <View style={[styles.seats, { marginTop: 18 }]}>
          {room.players.map((p, i) => (
            <Animated.View key={p.id} entering={ZoomIn.delay(150 + i * 90).duration(220)} style={styles.seat}>
              <Avatar name={p.nick || "?"} size={46} ring={p.id === myId ? NIGHT.accent : "white"} />
              <Text style={styles.seatName} numberOfLines={1}>
                {nameOf(p)}
              </Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>
    );
  } else if (room?.phase === "done") {
    const place = standings.findIndex((p) => p.id === myId) + 1;
    const placeText = place === 1 ? t("qzWinner") : locale === "tr" ? `${place}${t("qzPlace")}` : `${place}${["st", "nd", "rd"][place - 1] ?? "th"}${t("qzPlace")}`;
    const isHost = room.hostId === myId;
    const podium = [standings[1], standings[0], standings[2]];
    body = (
      <View style={{ flex: 1 }}>
        <Animated.View entering={SlideInDown.springify().damping(17).mass(0.9)} style={styles.podiumCard}>
          <Text style={styles.podiumTitle}>{placeText}</Text>
          <View style={styles.podium}>
            {podium.map((p, k) =>
              p ? (
                <View key={p.id} style={[styles.podiumSpot, { marginTop: k === 1 ? 0 : 26 }]}>
                  <Text style={styles.podiumRank}>{k === 1 ? 1 : k === 0 ? 2 : 3}.</Text>
                  {/* gold ring for you: the accent green would vanish on the green podium */}
                  <Avatar name={p.nick || "?"} size={k === 1 ? 64 : 52} ring={p.id === myId ? "#FACC15" : "white"} />
                  <Text style={styles.podiumName} numberOfLines={1}>
                    {nameOf(p)}
                  </Text>
                  <Text style={styles.podiumScore}>{p.score}</Text>
                </View>
              ) : (
                <View key={k} style={styles.podiumSpot} />
              )
            )}
          </View>
          {standings.slice(3).map((p, i) => (
            <View key={p.id} style={[styles.restRow, p.id === myId && { backgroundColor: NIGHT.light ? C.greenSoft : "#E0F9FF" }]}>
              <Text style={styles.restRank}>{i + 4}.</Text>
              <Avatar name={p.nick || "?"} size={26} />
              <Text style={styles.restName} numberOfLines={1}>
                {nameOf(p)}
              </Text>
              <Text style={styles.restScore}>{p.score}</Text>
            </View>
          ))}
          <View style={styles.myStrip}>
            <Icon name="star.fill" size={15} color="#FACC15" fallback="★" />
            <Text style={styles.myStripText}>
              {me?.score ?? 0} {t("qzPoints")}
            </Text>
          </View>
        </Animated.View>
        {progress && (
          <View style={{ marginTop: 14 }}>
            <LevelProgress {...progress} />
          </View>
        )}
        <Animated.View entering={FadeIn.delay(550).duration(300)} style={styles.endButtons}>
          <RoundButton icon="house.fill" label={t("tabHome")} onPress={() => router.dismissTo("/")} />
          {params.random ? (
            <RoundButton icon="arrow.clockwise" label={t("htNewGame")} onPress={() => router.replace("/bilgi/rastgele")} />
          ) : isHost ? (
            <RoundButton icon="arrow.clockwise" label={t("htRematch")} onPress={() => getSocket().emit("qz:rematch", { questions: quizQuestions(room.total, room.settings.category) })} />
          ) : (
            <View style={{ alignItems: "center", width: 120 }}>
              <Text style={[styles.sub, { textAlign: "center" }]}>{t("htWaitRematch")}</Text>
            </View>
          )}
        </Animated.View>
      </View>
    );
  } else if (room?.question) {
    const q = room.question;
    const reveal = room.phase === "reveal";
    const limitMs = room.settings.seconds * 1000;
    const leftMs = reveal ? 0 : Math.min(limitMs, Math.max(0, deadline - now));
    const low = !reveal && leftMs <= 5000;
    const mine = reveal ? (me?.choice ?? null) : picked;
    const others = room.players.filter((p) => p.id !== myId);

    body = (
      <Animated.View exiting={FadeOutUp.duration(280)} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <View style={styles.countChip}>
            <Text allowFontScaling={false} style={styles.countText}>
              {room.index + 1}/{room.total}
            </Text>
          </View>
          <Icon name={q.context ? "sportscourt.fill" : "person.fill"} size={26} color={NIGHT.ink} fallback="⚽" />
          <TimerRing fraction={leftMs / limitMs} seconds={Math.ceil(leftMs / 1000)} low={low} />
        </View>

        {/* the card stays; only its text changes */}
        <View style={styles.qCard}>
          <Animated.View key={room.index} entering={TEXT_IN} exiting={TEXT_OUT} style={{ alignItems: "center", gap: 8 }}>
            {q.context && <Text style={styles.qContext}>{tx(q.context)}</Text>}
            <Text style={styles.qText}>{tx(q.text)}</Text>
          </Animated.View>
        </View>

        <View style={styles.pillSlot}>
          {!reveal && picked !== null && room.players.some((p) => !p.answered) && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.pill}>
              <Text style={styles.pillText}>{t("qzWaitingOthers")}</Text>
            </Animated.View>
          )}
        </View>

        <View style={{ gap: 12 }}>
          {q.options.map((o, i) => {
            const right = reveal && i === room.answer;
            const wrong = reveal && mine === i && i !== room.answer;
            const chosen = !reveal && mine === i;
            const bg = right ? RIGHT : wrong ? WRONG : chosen ? PICKED : "white";
            const onColour = NIGHT.light && (right || wrong || chosen);
            const pickers = others.filter((p) => p.choice === i);
            return (
              <Animated.View key={`${room.index}-${i}`} entering={OPTION_IN(i)} exiting={OPTION_OUT(i)}>
                <Tap
                  disabled={reveal || picked !== null}
                  onPress={() => {
                    setPicked(i);
                    haptic.press();
                    getSocket().emit("qz:answer", { choice: i });
                  }}
                  style={[styles.option, { backgroundColor: bg }, bg !== "white" && { borderColor: bg }]}
                  accessibilityLabel={tx(o)}
                >
                  <Text style={[styles.optionText, onColour && { color: "white" }]} numberOfLines={2}>
                    {tx(o)}
                  </Text>
                </Tap>
                {mine === i && me && (
                  <Animated.View entering={ZoomIn.duration(180)} style={styles.myPick}>
                    <Avatar name={me.nick || "?"} size={30} ring={NIGHT.accent} />
                  </Animated.View>
                )}
                <View style={styles.theirPicks}>
                  {pickers.map((p, k) => (
                    <Animated.View key={p.id} entering={ZoomIn.duration(180)} style={{ marginLeft: k ? -12 : 0 }}>
                      <Avatar name={p.nick || "?"} size={30} />
                    </Animated.View>
                  ))}
                </View>
                {reveal && mine === i && (me?.gained ?? 0) > 0 && (
                  <Animated.View entering={POINTS_UP} style={styles.pointsUp}>
                    <Text style={styles.pointsUpText}>+{me?.gained}</Text>
                  </Animated.View>
                )}
              </Animated.View>
            );
          })}
        </View>

        {reveal && (me?.choice == null || me.choice !== room.answer) && (
          <Animated.View entering={FadeIn.delay(200).duration(200)} style={{ alignItems: "center", marginTop: 16 }}>
            <Text style={[styles.verdict, { color: me?.choice == null ? NIGHT.warn : WRONG }]}>{me?.choice == null ? t("qzTimeUp") : t("qzWrong")}</Text>
          </Animated.View>
        )}
      </Animated.View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, animation: "none", contentStyle: { backgroundColor: NIGHT.body } }} />
      <NightStatusBar />
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.3" stopColor={NIGHT.body} />
            <Stop offset="1" stopColor={NIGHT.bodyLow} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bg)" />
      </Svg>
      {/* the pitch shows once the questions start */}
      {(room?.phase === "question" || room?.phase === "reveal") && <GrassPattern />}
      {room?.phase !== "done" ? (
        <Animated.View exiting={FadeOutUp.duration(350)} style={StyleSheet.absoluteFill} pointerEvents="none">
          <StadiumHeader runners={runners} height={HEADER} />
        </Animated.View>
      ) : null}
      {leave}
      <View style={[styles.content, { paddingTop: room?.phase === "done" ? insets.top + 56 : insets.top + HEADER + 6 }]}>{body}</View>
      <Confetti fire={confetti} />
    </View>
  );
}

function WideButton({
  title,
  icon,
  kind = "primary",
  disabled,
  onPress,
}: {
  title: string;
  icon?: "play.fill" | "square.and.arrow.up";
  kind?: "primary" | "ghost";
  disabled?: boolean;
  onPress: () => void;
}) {
  const primary = kind === "primary";
  return (
    <Tap onPress={onPress} disabled={disabled} style={[styles.wide, primary ? styles.widePrimary : styles.wideGhost, disabled && { opacity: 0.45 }]}>
      {icon && <Icon name={icon} size={16} color={primary ? NIGHT.primaryInk : C.text} />}
      <Text style={[styles.wideText, { color: primary ? NIGHT.primaryInk : C.text }]}>{title}</Text>
    </Tap>
  );
}

function RoundButton({ icon, label, onPress }: { icon: "house.fill" | "arrow.clockwise"; label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={{ alignItems: "center", gap: 8, width: 120 }} accessibilityLabel={label}>
      <View style={styles.round}>
        <Icon name={icon} size={26} color={NIGHT.ink} fallback="•" />
      </View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Tap>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: NIGHT.body },
  content: { flex: 1, paddingHorizontal: 16 },
  leave: { position: "absolute", left: 12, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: NIGHT.raised, alignItems: "center", justifyContent: "center" },

  avatar: { alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarText: { color: "white", fontWeight: "800" },

  card: { backgroundColor: "white", borderRadius: 24, padding: 20 },
  cardTitle: { fontFamily: F.display, fontSize: 22, color: C.text, textAlign: "center" },
  caption: { fontSize: 13, fontWeight: "600", color: C.text2 },
  code: { fontFamily: F.black, fontSize: 48, letterSpacing: 6, color: C.text },
  big: { fontFamily: F.black, fontSize: 30, lineHeight: 34, color: NIGHT.ink, textAlign: "center" },
  sub: { fontSize: 15, color: NIGHT.ink2, fontWeight: "500" },

  seats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 },
  seat: { width: 62, alignItems: "center", gap: 6 },
  seatName: { fontSize: 12, fontWeight: "700", color: NIGHT.ink, maxWidth: 62 },
  emptySeat: { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderStyle: "dashed", borderColor: NIGHT.ink3 },

  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  countChip: { borderWidth: 2, borderColor: NIGHT.ink3, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 3, minWidth: 48, alignItems: "center" },
  countText: { fontFamily: F.display, fontSize: 16, color: NIGHT.ink },
  ring: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  ringText: { fontFamily: F.display, fontSize: 17, color: NIGHT.ink, fontVariant: ["tabular-nums"] },

  qCard: { backgroundColor: "white", borderWidth: NIGHT.light ? 1 : 0, borderColor: NIGHT.line, borderRadius: 26, minHeight: 138, paddingHorizontal: 18, paddingVertical: 18, justifyContent: "center" },
  qContext: { fontSize: 13, fontWeight: "600", color: C.text2, textAlign: "center" },
  qText: { fontSize: 19, lineHeight: 25, fontWeight: "700", color: C.text, textAlign: "center" },

  pillSlot: { height: 34, alignItems: "center", justifyContent: "center" },
  pill: { backgroundColor: "#F59E0B", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "800", color: "#3B2300" },

  option: { borderRadius: 999, borderWidth: NIGHT.light ? 1 : 0, borderColor: NIGHT.line, minHeight: 52, paddingHorizontal: 44, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  optionText: { fontSize: 16, fontWeight: "800", color: C.text, textAlign: "center" },
  myPick: { position: "absolute", left: -6, top: -8 },
  theirPicks: { position: "absolute", right: -6, top: -8, flexDirection: "row" },
  pointsUp: { position: "absolute", right: 34, top: -26 },
  pointsUpText: { fontFamily: F.black, fontSize: 30, color: NIGHT.gold, textShadowColor: NIGHT.light ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.35)", textShadowRadius: 4 },
  verdict: { fontFamily: F.black, fontSize: 26 },

  podiumCard: { backgroundColor: "#16A34A", borderRadius: 28, paddingTop: 18, paddingBottom: 16, paddingHorizontal: 14, gap: 8 },
  podiumTitle: { fontFamily: F.black, fontSize: 30, lineHeight: 34, color: "white", textAlign: "center" },
  podium: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start", marginBottom: 8 },
  podiumSpot: { width: 100, alignItems: "center", gap: 4 },
  podiumRank: { fontFamily: F.black, fontSize: 22, color: "white" },
  podiumName: { fontSize: 13, fontWeight: "700", color: "white", maxWidth: 100 },
  podiumScore: { fontFamily: F.display, fontSize: 20, color: "white" },
  restRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "white", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  restRank: { fontFamily: F.display, fontSize: 17, color: C.text2, width: 22 },
  restName: { flex: 1, fontSize: 15, fontWeight: "700", color: C.text },
  restScore: { fontFamily: F.display, fontSize: 19, color: C.text },
  myStrip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 4, marginTop: 4 },
  myStripText: { fontFamily: F.display, fontSize: 18, color: "white" },
  endButtons: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 24 },
  round: { width: 64, height: 64, borderRadius: 32, backgroundColor: NIGHT.raised, borderWidth: 2, borderColor: NIGHT.line, alignItems: "center", justifyContent: "center" },
  roundLabel: { fontSize: 14, fontWeight: "700", color: NIGHT.ink },

  wide: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 999, minHeight: 50, alignSelf: "stretch" },
  widePrimary: { backgroundColor: NIGHT.primary },
  wideGhost: { backgroundColor: C.bg },
  wideText: { fontFamily: F.display, fontSize: 20 },
});
