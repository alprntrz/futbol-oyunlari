import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";

import { quizQuestions, type QuizCategory } from "@/lib/quiz";

import { Confetti } from "~/components/motion";
import { Text } from "~/components/Text";
import { WaitingAnimation } from "~/components/WaitingAnimation";
import { Button, Card, Icon, Page, Tap } from "~/components/ui";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { loadNick } from "~/lib/nick";
import { getSocket } from "~/lib/socket";
import { C, F, R, T } from "~/lib/theme";

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

const LETTERS = ["A", "B", "C", "D"];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 45%, 48%)`;
}

function Avatar({ name, size = 30, ring }: { name: string; size?: number; ring?: string }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) }, ring ? { borderWidth: 2, borderColor: ring } : null]}>
      <Text allowFontScaling={false} style={[styles.avatarText, { fontSize: size * 0.42 }]}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </Text>
    </View>
  );
}

/** One quiz room, from the waiting list through the questions to the final standings. */
export default function QuizRoom() {
  const { t, locale } = useI18n();
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
  const lastPhase = useRef<string>("");

  useEffect(() => {
    const socket = getSocket();
    const apply = (r: QzRoom) => {
      setRoom(r);
      setDeadline(Date.now() + r.remainingMs);
      const key = `${r.phase}-${r.index}`;
      if (key !== lastPhase.current) {
        lastPhase.current = key;
        if (r.phase === "question") setPicked(null);
        if (r.phase === "reveal") {
          const me = r.players.find((p) => p.id === socket.id);
          if (me?.choice === r.answer) haptic.success();
          else haptic.error();
        }
        if (r.phase === "done") {
          const top = [...r.players].sort((a, b) => b.score - a.score)[0];
          if (top?.id === socket.id) setConfetti(Date.now());
        }
      }
    };
    const onConnect = () => setMyId(socket.id ?? "");
    socket.on("qz:update", apply);
    socket.on("connect", onConnect);
    loadNick().then((nick) =>
      socket.emit("qz:join", { code, nick }, (res: { ok: boolean; error?: string; room?: QzRoom }) => {
        if (res.ok && res.room) apply(res.room);
        else setError(res.error === "full" ? t("roomFull") : res.error === "started" ? t("qzRoomStarted") : t("roomNotFound"));
      })
    );
    return () => {
      socket.emit("qz:leave");
      socket.off("qz:update", apply);
      socket.off("connect", onConnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Clock for the question and the short pauses between them
  const ticking = room?.phase === "question" || room?.phase === "intro" || room?.phase === "reveal";
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [ticking]);

  const tx = (l: L) => (locale === "tr" ? l.tr : l.en);

  if (error) {
    return (
      <Page>
        <Stack.Screen options={{ title: t("qzName") }} />
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Icon name="exclamationmark.triangle.fill" size={30} color={C.amber} fallback="⚠️" />
          <Text style={[T.headline, { textAlign: "center" }]}>{error}</Text>
          <Button title={t("close")} kind="secondary" icon="chevron.left" onPress={() => router.back()} />
        </Card>
      </Page>
    );
  }
  if (!room) return <Page>{null}</Page>;

  const me = room.players.find((p) => p.id === myId);
  const isHost = room.hostId === myId;
  const nameOf = (p: QzPlayer) => (p.id === myId ? t("you") : p.nick || t("opponent"));
  const standings = [...room.players].sort((a, b) => b.score - a.score);
  const leftMs = Math.max(0, deadline - now);
  const limitMs = room.settings.seconds * 1000;

  // ── waiting room ──
  if (room.phase === "lobby") {
    const copy = async () => {
      await Clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    };
    return (
      <Page>
        <Stack.Screen options={{ title: t("qzName") }} />
        {room.random ? (
          <Card style={{ alignItems: "center", paddingVertical: 24, gap: 10 }}>
            <WaitingAnimation width={240} />
            <Text style={T.title}>{t("qzSearching")}</Text>
            <Text style={[T.body, { textAlign: "center" }]}>{t("qzSearchingDesc")}</Text>
          </Card>
        ) : (
          <Card style={{ alignItems: "center", gap: 12, padding: 22 }}>
            <Text style={T.caption}>{t("roomCode")}</Text>
            <Tap onPress={copy} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} accessibilityLabel={`${t("roomCode")} ${code.split("").join(" ")}`}>
              <Text style={styles.code}>{code}</Text>
              <Icon name={copied ? "checkmark.circle.fill" : "doc.on.doc"} size={20} color={copied ? C.green : C.text3} fallback="⧉" />
            </Tap>
            <Text style={T.caption}>
              {room.total} {t("qzSummary")}, {room.settings.seconds} {t("qzSecShort")}, {room.settings.maxPlayers} {t("qzMaxPlayers")}
            </Text>
            <Button
              title={t("shareCode")}
              kind="secondary"
              icon="square.and.arrow.up"
              onPress={() => Share.share({ message: `${t("qzInvite")} ${code}` })}
              style={{ alignSelf: "stretch" }}
            />
          </Card>
        )}

        <Card style={{ marginTop: 16, padding: 0, overflow: "hidden" }}>
          {Array.from({ length: room.settings.maxPlayers }, (_, i) => {
            const p = room.players[i];
            return (
              <View key={p?.id ?? `empty-${i}`} style={[styles.seat, i > 0 && styles.divider]}>
                {p ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.seatInner}>
                    <Avatar name={p.nick || "?"} size={34} />
                    <Text style={[T.headline, { flex: 1 }]}>{nameOf(p)}</Text>
                    {p.id === room.hostId && !room.random && <Icon name="crown.fill" size={14} color={C.amber} fallback="👑" />}
                  </Animated.View>
                ) : (
                  <View style={styles.seatInner}>
                    <View style={styles.emptySeat} />
                    <Text style={[T.body, { color: C.text3 }]}>…</Text>
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        {!room.random && (
          <View style={{ marginTop: 18, gap: 8 }}>
            {isHost ? (
              <>
                <Button title={t("start")} icon="play.fill" disabled={room.players.length < 2} onPress={() => getSocket().emit("qz:start")} />
                {room.players.length < 2 && <Text style={[T.caption, { textAlign: "center" }]}>{t("qzStartNeeds")}</Text>}
              </>
            ) : (
              <Text style={[T.body, { textAlign: "center" }]}>{t("waitingHost")}</Text>
            )}
          </View>
        )}
      </Page>
    );
  }

  // ── get ready ──
  if (room.phase === "intro") {
    return (
      <Page>
        <Stack.Screen options={{ title: t("qzName") }} />
        <View style={{ alignItems: "center", paddingTop: 60, gap: 14 }}>
          <Animated.View entering={ZoomIn.duration(240)}>
            <Text style={styles.ready}>{t("qzGetReady")}</Text>
          </Animated.View>
          <Text style={T.body}>
            {room.total} {t("qzSummary")}, {room.settings.seconds} {t("qzSecShort")}
          </Text>
          <View style={styles.introAvatars}>
            {room.players.map((p) => (
              <View key={p.id} style={{ alignItems: "center", gap: 4, width: 62 }}>
                <Avatar name={p.nick || "?"} size={44} ring={p.id === myId ? C.greenMid : undefined} />
                <Text style={[T.caption, { fontSize: 12 }]} numberOfLines={1}>
                  {nameOf(p)}
                </Text>
              </View>
            ))}
          </View>
          <View style={[styles.bar, { width: 220, marginTop: 20 }]}>
            <View style={[styles.barFill, { width: `${(1 - leftMs / 3000) * 100}%`, backgroundColor: C.greenMid }]} />
          </View>
        </View>
      </Page>
    );
  }

  // ── final standings ──
  if (room.phase === "done") {
    const place = standings.findIndex((p) => p.id === myId) + 1;
    const placeText = place === 1 ? t("qzWinner") : locale === "tr" ? `${place}${t("qzPlace")}` : `${place}${["st", "nd", "rd"][place - 1] ?? "th"}${t("qzPlace")}`;
    return (
      <Page>
        <Stack.Screen options={{ title: t("qzName") }} />
        <Animated.View entering={ZoomIn.duration(240)} style={{ alignItems: "center", marginTop: 8, gap: 6 }}>
          <Icon name="trophy.fill" size={44} color={place === 1 ? "#E0A100" : C.text3} fallback="🏆" />
          <Text style={styles.ready}>{placeText}</Text>
          <Text style={T.body}>
            {me?.score ?? 0} {t("qzPoints")}
          </Text>
        </Animated.View>
        <Card style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
          {standings.map((p, i) => (
            <Animated.View key={p.id} entering={FadeInDown.delay(i * 80).duration(220)} style={[styles.row, i > 0 && styles.divider, p.id === myId && { backgroundColor: C.greenSoft }]}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Avatar name={p.nick || "?"} size={32} />
              <Text style={[T.headline, { flex: 1 }]} numberOfLines={1}>
                {nameOf(p)}
              </Text>
              <Text style={styles.score}>{p.score}</Text>
            </Animated.View>
          ))}
        </Card>
        <View style={{ marginTop: 18, gap: 10 }}>
          {params.random ? (
            <Button title={t("htNewGame")} icon="play.fill" onPress={() => router.replace("/bilgi/rastgele")} />
          ) : isHost ? (
            <Button title={t("htRematch")} icon="arrow.clockwise" onPress={() => getSocket().emit("qz:rematch", { questions: quizQuestions(room.total, room.settings.category) })} />
          ) : (
            <Text style={[T.body, { textAlign: "center" }]}>{t("htWaitRematch")}</Text>
          )}
          <Button title={t("close")} kind="secondary" onPress={() => router.back()} />
        </View>
        <Confetti fire={confetti} />
      </Page>
    );
  }

  // ── question / reveal ──
  const q = room.question!;
  const reveal = room.phase === "reveal";
  const mine = reveal ? (me?.choice ?? null) : picked;
  const low = !reveal && leftMs <= 5000;
  const answered = room.players.filter((p) => p.answered).length;

  return (
    <Page>
      <Stack.Screen options={{ title: `${t("qzQuestionOf")} ${room.index + 1}/${room.total}` }} />
      <View style={styles.top}>
        <View style={[styles.timer, low && { backgroundColor: C.redSoft }]}>
          <Icon name="stopwatch.fill" size={15} color={low ? C.red : C.text2} fallback="⏱" />
          <Text style={[styles.timerText, low && { color: C.red }]}>{reveal ? 0 : Math.ceil(leftMs / 1000)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={T.caption}>{t("qzYourScore")}</Text>
        <Text style={styles.myScore}>{me?.score ?? 0}</Text>
      </View>
      <View style={[styles.bar, { marginTop: 10 }]}>
        <View style={[styles.barFill, { width: `${reveal ? 0 : (leftMs / limitMs) * 100}%`, backgroundColor: low ? C.red : C.greenMid }]} />
      </View>

      <Animated.View key={room.index} entering={FadeIn.duration(220)}>
        <Card style={styles.question}>
          {q.context && <Text style={[T.caption, { textAlign: "center" }]}>{tx(q.context)}</Text>}
          <Text style={styles.questionText}>{tx(q.text)}</Text>
        </Card>

        <View style={{ gap: 10, marginTop: 14 }}>
          {q.options.map((o, i) => {
            const right = reveal && i === room.answer;
            const wrongPick = reveal && mine === i && i !== room.answer;
            const chosen = !reveal && mine === i;
            const pickers = reveal ? room.players.filter((p) => p.choice === i) : [];
            return (
              <Tap
                key={i}
                disabled={reveal || picked !== null}
                onPress={() => {
                  setPicked(i);
                  haptic.press();
                  getSocket().emit("qz:answer", { choice: i });
                }}
                style={[
                  styles.option,
                  chosen && styles.optionChosen,
                  right && styles.optionRight,
                  wrongPick && styles.optionWrong,
                  reveal && !right && !wrongPick && { opacity: 0.55 },
                ]}
                accessibilityLabel={`${LETTERS[i]}: ${tx(o)}`}
              >
                <View style={[styles.letter, (chosen || right || wrongPick) && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                  <Text style={[styles.letterText, (chosen || right || wrongPick) && { color: "white" }]}>{LETTERS[i]}</Text>
                </View>
                <Text style={[styles.optionText, (chosen || right || wrongPick) && { color: "white" }]} numberOfLines={2}>
                  {tx(o)}
                </Text>
                <View style={{ flexDirection: "row", marginLeft: "auto" }}>
                  {pickers.map((p, k) => (
                    <View key={p.id} style={{ marginLeft: k ? -8 : 0 }}>
                      <Avatar name={p.nick || "?"} size={24} ring="white" />
                    </View>
                  ))}
                </View>
                {right && <Icon name="checkmark.circle.fill" size={20} color="white" fallback="✓" />}
                {wrongPick && <Icon name="xmark.circle.fill" size={20} color="white" fallback="×" />}
              </Tap>
            );
          })}
        </View>
      </Animated.View>

      {reveal ? (
        <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
          <View style={styles.result}>
            <Text style={[styles.resultText, { color: me?.choice === room.answer ? C.green : C.red }]}>
              {me?.choice === room.answer ? `${t("qzCorrect")} +${me?.gained ?? 0}` : me?.choice == null ? t("qzTimeUp") : t("qzWrong")}
            </Text>
          </View>
          <Card style={{ marginTop: 10, padding: 0, overflow: "hidden" }}>
            {standings.map((p, i) => (
              <View key={p.id} style={[styles.row, styles.rowSmall, i > 0 && styles.divider, p.id === myId && { backgroundColor: C.greenSoft }]}>
                <Text style={[styles.rank, { fontSize: 17 }]}>{i + 1}</Text>
                <Avatar name={p.nick || "?"} size={26} />
                <Text style={[T.body, { flex: 1, color: C.text, fontWeight: "600" }]} numberOfLines={1}>
                  {nameOf(p)}
                </Text>
                {p.gained > 0 && <Text style={styles.gained}>+{p.gained}</Text>}
                <Text style={[styles.score, { fontSize: 19 }]}>{p.score}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>
      ) : (
        <View style={styles.waiting}>
          <View style={{ flexDirection: "row" }}>
            {room.players.map((p, k) => (
              <View key={p.id} style={{ marginLeft: k ? -6 : 0, opacity: p.answered ? 1 : 0.3 }}>
                <Avatar name={p.nick || "?"} size={28} ring="white" />
              </View>
            ))}
          </View>
          <Text style={T.caption}>
            {picked !== null ? t("qzWaitingOthers") : ""} {answered}/{room.players.length}
          </Text>
        </View>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  avatarText: { color: "white", fontWeight: "800" },
  code: { fontFamily: F.black, fontSize: 52, letterSpacing: 6, color: C.text },
  seat: { paddingHorizontal: 14, paddingVertical: 10 },
  seatInner: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 34 },
  emptySeat: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderStyle: "dashed", borderColor: C.border },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  ready: { fontFamily: F.black, fontSize: 40, lineHeight: 44, color: C.text, textAlign: "center" },
  introAvatars: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 16 },
  bar: { height: 6, borderRadius: 3, backgroundColor: "#E2E6EC", overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  timer: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: C.border },
  timerText: { fontFamily: F.display, fontSize: 22, lineHeight: 26, color: C.text, fontVariant: ["tabular-nums"], minWidth: 24, textAlign: "center" },
  myScore: { fontFamily: F.black, fontSize: 26, color: C.text },
  question: { marginTop: 16, paddingVertical: 22, paddingHorizontal: 18, gap: 10, alignItems: "center" },
  questionText: { fontFamily: F.display, fontSize: 25, lineHeight: 29, color: C.text, textAlign: "center" },
  option: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.card, borderRadius: R.card, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 12, minHeight: 58 },
  optionChosen: { backgroundColor: C.blue, borderColor: C.blue },
  optionRight: { backgroundColor: C.green, borderColor: C.green },
  optionWrong: { backgroundColor: C.red, borderColor: C.red },
  letter: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  letterText: { fontFamily: F.black, fontSize: 17, color: C.text2 },
  optionText: { flexShrink: 1, fontSize: 17, fontWeight: "700", color: C.text },
  result: { alignItems: "center" },
  resultText: { fontFamily: F.black, fontSize: 28 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  rowSmall: { paddingVertical: 7 },
  rank: { fontFamily: F.black, fontSize: 20, width: 22, textAlign: "center", color: C.text2 },
  score: { fontFamily: F.black, fontSize: 22, color: C.text, minWidth: 34, textAlign: "right" },
  gained: { fontFamily: F.display, fontSize: 16, color: C.green },
  waiting: { alignItems: "center", gap: 6, marginTop: 18 },
});
