import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View } from "react-native";

import { BUDGET, CARDS, cardById, DRAFT_SECONDS, HAND_SIZE, handCost, searchCards, type DuelCard } from "@/lib/duel";

import { DuelCardView } from "~/components/duel/DuelCardView";
import { Flag } from "~/components/Flag";
import { STAR_FRAME } from "~/components/taktik/Card";
import { Text } from "~/components/Text";
import { Button, Icon, Page, Tap } from "~/components/ui";
import { saveHand, useDuel } from "~/lib/duel";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, R, T } from "~/lib/theme";

/** Draft: 7 cards under the budget from today's theme; tap a card in the hand to take it out. */
export default function DuelDraft() {
  const { t } = useI18n();
  const { hand, theme, ready } = useDuel();
  const [picked, setPicked] = useState<number[]>(() => (ready ? hand : []));
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [left, setLeft] = useState(DRAFT_SECONDS);
  const [shuffle, setShuffle] = useState(0);
  const { width } = useWindowDimensions();
  const slotW = (width - 32 - 6 * (HAND_SIZE - 1)) / HAND_SIZE;

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(null), 1600);
    return () => clearTimeout(id);
  }, [note]);

  const cost = handCost(picked);
  const results = useMemo(() => searchCards(query, theme), [query, theme]);
  // with nothing typed: a few players from today's theme, a mix of tiers (Shuffle for others)
  const suggestions = useMemo(() => {
    void shuffle;
    const pool = CARDS.filter(theme.test);
    const pick = (tier: number, n: number) =>
      pool
        .filter((c) => c.tier === tier)
        .sort(() => Math.random() - 0.5)
        .slice(0, n);
    return [...pick(3, 3), ...pick(2, 4), ...pick(1, 3)];
  }, [theme, shuffle]);
  const full = picked.length >= HAND_SIZE;

  const add = (c: DuelCard) => {
    if (picked.includes(c.id)) return setNote(t("dzAlready"));
    if (full) return setNote(t("dzFull"));
    if (cost + c.tier > BUDGET) {
      haptic.error();
      return setNote(t("dzOverBudget"));
    }
    haptic.success();
    setPicked([...picked, c.id]);
    setQuery("");
  };
  const remove = (id: number) => {
    haptic.tap();
    setPicked(picked.filter((x) => x !== id));
  };
  const save = () => {
    haptic.success();
    saveHand(picked);
    if (router.canGoBack()) router.back();
    else router.replace("/duello");
  };

  const mm = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <Page>
      <Stack.Screen options={{ title: t("dzDraft") }} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={T.caption}>{t("dzTheme")}</Text>
          <Text style={styles.theme}>{t(`dzTheme_${theme.id}`)}</Text>
        </View>
        <View style={[styles.clock, left === 0 && { backgroundColor: C.redSoft }]}>
          <Text style={[styles.clockText, left === 0 && { color: C.red }]}>{mm}</Text>
        </View>
      </View>

      {/* budget */}
      <View style={styles.budgetRow}>
        <Text style={styles.budgetText}>{t("dzBudget").replace("{n}", String(cost)).replace("{max}", String(BUDGET))}</Text>
        <Text style={T.caption}>
          {picked.length}/{HAND_SIZE}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, (cost / BUDGET) * 100)}%` }, cost === BUDGET && { backgroundColor: "#E3A008" }]} />
      </View>

      {/* hand: tap a card to take it out */}
      <View style={styles.hand}>
        {Array.from({ length: HAND_SIZE }, (_, i) => {
          const id = picked[i];
          return id !== undefined ? (
            <DuelCardView key={id} card={cardById(id) ?? null} width={slotW} onPress={() => remove(id)} />
          ) : (
            <View key={`e${i}`} style={[styles.empty, { width: slotW, height: slotW * 1.36 }]}>
              <Text style={styles.emptyText}>{i + 1}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.noteSlot}>{note && <Text style={styles.note}>{note}</Text>}</View>

      {full ? (
        <Button title={t("dzSave")} icon="checkmark" onPress={save} />
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("dzSearch")}
            placeholderTextColor={C.text3}
            autoCorrect={false}
            autoCapitalize="words"
            style={styles.input}
          />
          {left === 0 && <Text style={[T.caption, { color: C.red, marginTop: 6 }]}>{t("dzTimeUp")}</Text>}
          <View style={{ marginTop: 8, gap: 6 }}>
            {query.trim().length === 1 ? (
              <Text style={T.caption}>{t("dzSearchHint")}</Text>
            ) : query.trim().length >= 2 && results.length === 0 ? (
              <Text style={T.caption}>{t("dzNoResults")}</Text>
            ) : (
              <>
                {query.trim().length === 0 && (
                  <View style={styles.suggestHead}>
                    <Text style={[T.caption, { fontWeight: "700" }]}>{t("dzSuggested")}</Text>
                    <Tap onPress={() => (haptic.tap(), setShuffle(shuffle + 1))} style={styles.shuffle} accessibilityLabel={t("dzShuffle")}>
                      <Icon name="shuffle" size={13} color={C.greenDark} fallback="⇄" />
                      <Text style={styles.shuffleText}>{t("dzShuffle")}</Text>
                    </Tap>
                  </View>
                )}
                {(query.trim().length === 0 ? suggestions : results).map((c) => {
                const taken = picked.includes(c.id);
                const tooMuch = cost + c.tier > BUDGET;
                return (
                  <Tap key={c.id} onPress={() => add(c)} style={[styles.result, (taken || tooMuch) && { opacity: 0.45 }]} accessibilityLabel={`${c.name}, ${t(`dzTier_${c.tier}`)}`}>
                    <Flag id={c.country} width={26} />
                    <Text style={styles.resultName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <View style={[styles.tier, { backgroundColor: STAR_FRAME[c.tier] }]}>
                      <Text style={styles.tierText}>{c.tier}</Text>
                    </View>
                  </Tap>
                );
                })}
              </>
            )}
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  theme: { fontFamily: F.display, fontSize: 20, color: C.text },
  clock: { backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
  clockText: { fontFamily: F.display, fontSize: 18, color: C.text, fontVariant: ["tabular-nums"] },
  budgetRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 },
  budgetText: { fontFamily: F.display, fontSize: 17, color: C.text },
  track: { height: 8, borderRadius: 4, backgroundColor: "#E3E8E4", marginTop: 6, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4, backgroundColor: C.green },
  hand: { flexDirection: "row", gap: 6, marginTop: 14 },
  suggestHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  shuffle: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  shuffleText: { fontWeight: "700", fontSize: 13, color: C.greenDark },
  empty: { borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: C.border, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: F.display, fontSize: 20, color: C.text3 },
  noteSlot: { height: 28, justifyContent: "center", alignItems: "center" },
  note: { fontWeight: "700", color: C.red, fontSize: 14 },
  input: { backgroundColor: C.card, borderRadius: R.button, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, color: C.text },
  result: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  resultName: { flex: 1, fontSize: 16, fontWeight: "700", color: C.text },
  tier: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tierText: { color: "white", fontFamily: F.display, fontSize: 14 },
});
