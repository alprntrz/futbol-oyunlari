import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
} from "react-native-reanimated";

import { RONDO_MAX_ROUNDS, RONDO_TARGET } from "@/lib/rondo";
import { searchPlayers } from "@/lib/tiki";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import type { RondoMatch } from "~/lib/rondoMatch";
import { C, F, GAME, R, T, shadow } from "~/lib/theme";

import { CriterionBadge } from "./HatTrickBoard";
import { PlayerLine, PlayerToken } from "./PlayerRow";
import { Text } from "./Text";
import { Button, Icon, Tap } from "./ui";

/**
 * The Rondo match screen, the same online and against the house player: the score and
 * the club up top, the clock, the names said so far (yours green, theirs coral), and the
 * search box at the bottom that answers on your turn.
 */
export function RondoBoard({
  m,
  footer,
}: {
  m: RondoMatch;
  footer?: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const [input, setInput] = useState("");
  // a new club (or a rematch): start with an empty box
  const [lastRound, setLastRound] = useState(`${m.key}-${m.round}`);
  if (lastRound !== `${m.key}-${m.round}`) {
    setLastRound(`${m.key}-${m.round}`);
    setInput("");
  }
  const [now, setNow] = useState(() => Date.now());
  const list = useRef<ScrollView>(null);

  useEffect(() => {
    if (!m.deadline) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [m.deadline]);

  // a new name: to the bottom of the list, light tick for theirs
  const count = m.names.length;
  useEffect(() => {
    if (!count) return;
    list.current?.scrollToEnd({ animated: true });
    if (!m.names[count - 1].mine) haptic.tap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
  useEffect(() => {
    if (m.wrong) haptic.error();
  }, [m.wrong]);
  useEffect(() => {
    if (m.roundEnd) (m.roundEnd.won ? haptic.success : haptic.error)();
  }, [m.roundEnd]);

  const left = m.deadline ? Math.max(0, m.deadline - now) : 0;
  const secs = Math.ceil(left / 1000);
  const frac = m.turnMs ? Math.min(1, left / m.turnMs) : 0;
  const said = useMemo(() => new Set(m.names.map((n) => n.name)), [m.names]);
  const suggestions = useMemo(
    () => (m.myTurn && input.trim().length >= 2 ? searchPlayers(input, 6) : []),
    [input, m.myTurn],
  );
  const clubName = m.club ? (locale === "tr" ? m.club.tr : m.club.en) : "…";

  const send = (name: string) => {
    if (!name.trim()) return;
    m.answer(name);
    setInput("");
  };

  const confirmForfeit = () =>
    Alert.alert(t("rdForfeitTitle"), t("rdForfeitBody"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("htForfeit"), style: "destructive", onPress: m.forfeit },
    ]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* score: you – them, with a dot per round */}
      <View style={styles.scoreRow}>
        <Text style={[styles.side, { color: C.greenDark }]} numberOfLines={1}>
          {t("you")}
        </Text>
        <Text style={styles.score}>
          {m.score.me} – {m.score.them}
        </Text>
        <Text
          style={[styles.side, { textAlign: "right", color: C.coral }]}
          numberOfLines={1}
        >
          {m.opponent?.nick || t("opponent")}
        </Text>
      </View>

      {/* the club of this round */}
      <View style={[styles.clubCard, { backgroundColor: GAME.rd.bg }]}>
        {m.club && <CriterionBadge c={m.club} size={46} />}
        <View style={{ flex: 1 }}>
          <Text style={[styles.roundLabel, { color: GAME.rd.ink }]}>
            {t("rdRound")
              .replace("{n}", String(m.round + 1))
              .replace("{max}", String(RONDO_MAX_ROUNDS))}
          </Text>
          <Text style={[styles.club, { color: GAME.rd.ink }]} numberOfLines={2}>
            {clubName}
          </Text>
        </View>
      </View>

      {/* whose turn + clock */}
      <View style={styles.turnRow}>
        <Text style={[styles.turn, { color: m.myTurn ? C.greenMid : C.coral }]}>
          {m.over
            ? ""
            : m.roundEnd
              ? " "
              : m.myTurn
                ? t("rdYourTurn")
                : t("rdTheirTurn")}
        </Text>
        {!m.roundEnd && !m.over && m.deadline > 0 && (
          <Text style={[styles.secs, secs <= 5 && { color: C.red }]}>
            {secs}s
          </Text>
        )}
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            {
              width: `${frac * 100}%`,
              backgroundColor: m.myTurn ? C.green : C.coral,
            },
            secs <= 5 && { backgroundColor: C.red },
          ]}
        />
      </View>

      {/* the names said so far */}
      <ScrollView
        ref={list}
        style={{ flex: 1 }}
        contentContainerStyle={styles.names}
        keyboardShouldPersistTaps="handled"
      >
        {m.names.length === 0 && !m.roundEnd && (
          <Text
            style={[
              T.body,
              { textAlign: "center", color: C.text2, marginTop: 24 },
            ]}
          >
            {m.myTurn ? t("rdStartYou") : t("rdStartThem")}
          </Text>
        )}
        {m.names.map((n, i) => (
          <Animated.View
            key={`${i}-${n.name}`}
            entering={FadeInDown.duration(180)}
            style={[styles.name, n.mine ? styles.nameMine : styles.nameTheirs]}
          >
            <Icon
              name={n.mine ? "checkmark.circle.fill" : "person.fill"}
              size={16}
              color={n.mine ? C.greenMid : C.coral}
            />
            <Text
              style={[
                styles.nameText,
                { color: n.mine ? C.greenDark : "#9F1239" },
              ]}
              numberOfLines={1}
            >
              {n.name}
            </Text>
          </Animated.View>
        ))}
      </ScrollView>

      {/* a wrong try: only the mover sees it */}
      {m.wrong && m.myTurn && (
        <Animated.View
          key={m.wrong.id}
          entering={ZoomIn.duration(160)}
          exiting={FadeOut.duration(150)}
          style={styles.wrong}
        >
          <Text style={styles.wrongText}>
            {t(
              m.wrong.reason === "used"
                ? "rdUsed"
                : m.wrong.reason === "wrong"
                  ? "rdWrong"
                  : "rdUnknown",
            ).replace("{name}", m.wrong.guess)}
          </Text>
        </Animated.View>
      )}

      {/* answer box (my turn), the suggestions open upwards */}
      {!m.over && (
        <View style={styles.bottom}>
          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((p, i) => (
                <Tap
                  key={p.name}
                  disabled={said.has(p.name)}
                  onPress={() => send(p.name)}
                  style={[
                    styles.suggestion,
                    i > 0 && styles.divider,
                    said.has(p.name) && { opacity: 0.4 },
                  ]}
                >
                  <PlayerToken p={p} />
                  <PlayerLine p={p} />
                </Tap>
              ))}
            </View>
          )}
          <View style={[styles.inputWrap, !m.myTurn && { opacity: 0.5 }]}>
            <Icon
              name="magnifyingglass"
              size={16}
              color={C.text3}
              fallback="🔎"
            />
            <TextInput
              value={input}
              onChangeText={setInput}
              editable={m.myTurn}
              onSubmitEditing={() =>
                suggestions.length === 1
                  ? send(suggestions[0].name)
                  : send(input)
              }
              placeholder={m.myTurn ? t("rdPlaceholder") : t("rdWaiting")}
              placeholderTextColor={C.text3}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="send"
              style={styles.input}
            />
          </View>
          <View style={styles.actions}>
            {m.myTurn && m.timeJokers > 0 && (
              <Tap
                onPress={() => (haptic.tap(), m.useTime())}
                style={styles.joker}
                accessibilityRole="button"
                accessibilityHint={t("jkNote")}
              >
                <Icon name="stopwatch.fill" size={14} color={C.blue} />
                <Text style={styles.jokerText}>{t("jkTime10")}</Text>
                <Text style={styles.jokerCount}>×{m.timeJokers}</Text>
              </Tap>
            )}
            <Tap
              onPress={confirmForfeit}
              style={styles.forfeit}
              accessibilityRole="button"
            >
              <Icon name="flag.fill" size={13} color={C.text3} />
              <Text style={styles.forfeitText}>{t("htForfeit")}</Text>
            </Tap>
          </View>
        </View>
      )}

      {/* round result, between clubs */}
      {m.roundEnd && !m.over && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.overlay}
          pointerEvents="none"
        >
          <Animated.View
            entering={ZoomIn.duration(220)}
            style={styles.roundCard}
          >
            <Text
              style={[
                styles.roundTitle,
                { color: m.roundEnd.won ? C.greenMid : C.red },
              ]}
            >
              {m.roundEnd.won ? t("rdRoundWon") : t("rdRoundLost")}
            </Text>
            <Text style={T.body}>
              {m.roundEnd.won ? t("rdTheirTime") : t("rdYourTime")}
            </Text>
            <Text style={styles.roundScore}>
              {m.score.me} – {m.score.them}
            </Text>
            <Text style={T.caption}>
              {t("rdFirstTo").replace("{n}", String(RONDO_TARGET))}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
      {footer}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  side: { flex: 1, fontFamily: F.display, fontSize: 20 },
  score: { fontFamily: F.black, fontSize: 34, color: C.text },
  clubCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: R.card,
    padding: 14,
  },
  roundLabel: { fontFamily: F.semi, fontSize: 14, opacity: 0.8 },
  club: { fontFamily: F.display, fontSize: 28, lineHeight: 30 },
  turnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 14,
  },
  turn: { fontFamily: F.display, fontSize: 20 },
  secs: { fontFamily: F.black, fontSize: 22, color: C.text },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
    overflow: "hidden",
    marginTop: 6,
  },
  barFill: { height: 8, borderRadius: 4 },
  names: { gap: 6, paddingVertical: 12 },
  name: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: R.inner,
    maxWidth: "85%",
  },
  nameMine: { alignSelf: "flex-start", backgroundColor: C.greenSoft },
  nameTheirs: { alignSelf: "flex-end", backgroundColor: C.coralSoft },
  nameText: { fontFamily: F.display, fontSize: 18, flexShrink: 1 },
  wrong: {
    alignSelf: "center",
    backgroundColor: C.red,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginBottom: 8,
  },
  wrongText: { color: "white", fontWeight: "800", fontSize: 14 },
  bottom: { paddingBottom: 6 },
  suggestions: {
    backgroundColor: C.card,
    borderRadius: R.button,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    ...shadow,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.card,
    borderRadius: R.button,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 17, color: C.text },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  joker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  jokerText: { fontFamily: F.display, fontSize: 16, color: C.text },
  jokerCount: { fontSize: 12, fontWeight: "800", color: C.text3 },
  forfeit: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  forfeitText: { color: C.text3, fontWeight: "700", fontSize: 13 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(241,244,241,0.85)",
  },
  roundCard: {
    backgroundColor: C.card,
    borderRadius: R.card,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 6,
    ...shadow,
  },
  roundTitle: { fontFamily: F.display, fontSize: 32 },
  roundScore: {
    fontFamily: F.black,
    fontSize: 44,
    color: C.text,
    marginTop: 4,
  },
});

/** End of the match, shown by the screens under the board (rematch / new opponent). */
export function RondoEnd({ m, onNew }: { m: RondoMatch; onNew?: () => void }) {
  const { t } = useI18n();
  if (!m.over) return null;
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {m.rematch ? (
        <Button
          title={t("htRematch")}
          icon="arrow.clockwise"
          onPress={m.rematch}
        />
      ) : (
        !m.peerLeft && (
          <Text style={[T.body, { textAlign: "center" }]}>
            {t("htWaitRematch")}
          </Text>
        )
      )}
      {onNew && (
        <Button
          title={t("htNewGame")}
          kind="secondary"
          icon="play.fill"
          onPress={onNew}
        />
      )}
    </View>
  );
}
