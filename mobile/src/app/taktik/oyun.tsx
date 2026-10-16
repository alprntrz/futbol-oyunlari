import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XP } from "@/lib/levels";
import { ALL_CRITERIA } from "@/lib/tiki";
import { alive, bench, buy, buyXp, chooseAugment, equip, fieldCap, fielded, move, namesPlayer, priceOf, reroll, roundKind, sell, sellValue, xpToNext } from "@/lib/taktik/engine";
import { INCOME, INTEREST_STEP, REROLL_COST, SCOUT_DISCOUNT, SLOTS, START_HP, streakGold, XP_COST, type Pos } from "@/lib/taktik/rules";
import { sheet } from "@/lib/taktik/sim";
import { STYLES, type TraitState } from "@/lib/taktik/traits";
import type { Manager, ShopCard } from "@/lib/taktik/types";

import { FocusStatusBar } from "~/components/StadiumHeader";
import { Flag } from "~/components/Flag";
import { ClubShirt } from "~/components/HatTrickBoard";
import { COST_COLOR, ItemIcon, PosTag, UnitCard, clubCriterion } from "~/components/taktik/Card";
import { MatchView } from "~/components/taktik/MatchView";
import { Text } from "~/components/Text";
import { TourOverlay, useTour } from "~/components/Tour";
import { Button, Icon, Tap } from "~/components/ui";
import { TAKTIK } from "~/lib/brand";
import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { act, kickOff, quitTaktik, useTaktik } from "~/lib/taktik";
import { C, F, T } from "~/lib/theme";
import { useXpAward } from "~/lib/xp";

type Sel = { kind: "unit"; uid: string } | { kind: "item"; index: number } | null;

const COUNTRY = new Map(ALL_CRITERIA.filter((c) => c.kind === "country").map((c) => [c.id, c]));
const ROWS: Pos[] = ["FWD", "MID", "DEF", "GK"];

/**
 * One Taktik Tahtası game: health table, the pitch (12 spots by zone), synergies,
 * items, the bench, the shop and the buttons. Tap a player, then a spot.
 */
export default function TaktikGame() {
  // the engine mutates the lobby in place: no compiler memoization here
  "use no memo";
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lobby } = useTaktik();
  const [sel, setSel] = useState<Sel>(null);
  const [note, setNote] = useState<string | null>(null);
  const [match, setMatch] = useState(false);
  const [scout, setScout] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [scoutMsg, setScoutMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<TraitState | null>(null);
  const scroller = useRef<ScrollView>(null);
  // first game: a walkthrough that lights up each part of the screen in turn
  const tour = useTour("taktik-v1", [
    { target: "shop", title: t("ttkTour1T"), body: t("ttkTour1") },
    { target: "gold", title: t("ttkTour2T"), body: t("ttkTour2").replace("{income}", String(INCOME)).replace("{step}", String(INTEREST_STEP)) },
    { target: "pitch", title: t("ttkTour3T"), body: t("ttkTour3") },
    { target: "traits", title: t("ttkTour4T"), body: t("ttkTour4") },
    { target: "bench", title: t("ttkTour5T"), body: t("ttkTour5"), before: () => scroller.current?.scrollToEnd({ animated: true }) },
    { target: "reroll", title: t("ttkTour6T"), body: t("ttkTour6").replace("{g}", String(REROLL_COST)) },
    { target: "xp", title: t("ttkTour7T"), body: t("ttkTour7").replace("{g}", String(XP_COST)) },
    { target: "hp", title: t("ttkTour8T"), body: t("ttkTour8"), before: () => scroller.current?.scrollTo({ y: 0, animated: true }) },
    { target: "table", title: t("ttkTour9T"), body: t("ttkTour9") },
    { target: "kick", title: t("ttkTour10T"), body: t("ttkTour10") },
  ]);

  const me: Manager | undefined = lobby?.managers[0];
  const out = !!me && (me.place !== null || !!lobby?.over);
  // a new round: say where the gold came from (salary, interest, streak), like the reference game's round card
  const roundKey = lobby ? `${lobby.stage}-${lobby.round}` : "";
  const [incomeSeen, setIncomeSeen] = useState("");
  const inc = me?.income;
  const incomeNote =
    inc && !match && incomeSeen !== roundKey
      ? `+${inc.base + inc.interest + inc.streak} 🪙 · ${[
          t("ttkIncomeBase").replace("{g}", String(inc.base)),
          inc.interest ? t("ttkIncomeInterest").replace("{g}", String(inc.interest)) : "",
          inc.streak ? t("ttkIncomeStreak").replace("{g}", String(inc.streak)) : "",
        ]
          .filter(Boolean)
          .join(" · ")}`
      : null;
  useEffect(() => {
    if (!incomeNote) return;
    const id = setTimeout(() => setIncomeSeen(roundKey), 3500);
    return () => clearTimeout(id);
  }, [incomeNote, roundKey]);
  // a plain "+XP" toast: the reward screen is a second modal on top of the end card and froze the screen
  useXpAward(out && !match && !!me?.place, `ttk-${lobby?.seed}`, "tt", me?.place ? XP.ttPlace[me.place - 1] : 0, {
    label: me?.place === 1 ? t("ttkWinner") : t("ttkPlace").replace("{n}", String(me?.place ?? "")),
  });

  if (!lobby || !me) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Stack.Screen options={{ title: t("ttkName") }} />
      </View>
    );
  }

  const flash = (s: string) => {
    setNote(s);
    haptic.warning();
    setTimeout(() => setNote((n) => (n === s ? null : n)), 1800);
  };

  const selectedUnit = sel?.kind === "unit" ? me.units.find((u) => u.uid === sel.uid) : undefined;
  const cap = fieldCap(me);
  const onPitch = fielded(me);
  const sh = sheet({ name: me.name, units: me.units, coach: me.coach, augments: me.augments });
  const traits = sh.traits.filter((x) => x.count >= 1 && (x.tier > 0 || x.count >= x.steps[0] - 1));

  // sizes: four cards across the widest pitch row
  const pitchW = width - 24;
  const cardW = Math.min(78, (pitchW - 16 - 3 * 6) / 4);
  const benchW = Math.min(58, cardW * 0.78);
  const shopW = (width - 24 - 4 * 6) / 5;

  const tapUnit = (uid: string) => {
    haptic.tap();
    const u = me.units.find((x) => x.uid === uid)!;
    if (sel?.kind === "item") {
      if (!act(() => equip(me, sel.index, uid))) flash(t("ttkFieldFull"));
      setSel(null);
      return;
    }
    if (sel?.kind === "unit" && sel.uid !== uid && selectedUnit) {
      // swap / place the selected one where this one stands
      if (u.slot !== null) {
        act(() => move(me, selectedUnit.uid, u.slot));
        setSel(null);
        return;
      }
      if (selectedUnit.slot !== null) {
        act(() => move(me, uid, selectedUnit.slot));
        setSel(null);
        return;
      }
    }
    setSel(sel?.kind === "unit" && sel.uid === uid ? null : { kind: "unit", uid });
  };

  const tapSlot = (slot: number) => {
    if (sel?.kind !== "unit") return;
    if (!act(() => move(me, sel.uid, slot))) flash(t("ttkFieldFull"));
    else haptic.tap();
    setSel(null);
  };

  const tapBench = () => {
    if (sel?.kind !== "unit") return;
    if (!act(() => move(me, sel.uid, null))) flash(t("ttkBenchFull"));
    setSel(null);
  };

  const tapShop = (i: number, card: ShopCard) => {
    if (sel) return setSel(null);
    if (card.scout) {
      setScout(i);
      setGuess("");
      setScoutMsg(null);
      return;
    }
    const r = act((l) => buy(l, me, i));
    if (r === "gold") flash(t("ttkNoGold"));
    else if (r === "full") flash(t("ttkBenchFull"));
    else haptic.success();
  };

  const scoutCard = scout !== null ? me.shop[scout] : null;
  const scoutPlayer = scoutCard ? lobby.players[scoutCard.pid] : null;
  const tryScout = () => {
    if (scout === null || !scoutPlayer) return;
    if (!namesPlayer(guess, scoutPlayer.name)) {
      setScoutMsg(t("ttkScoutWrong"));
      haptic.error();
      return;
    }
    const r = act((l) => buy(l, me, scout, guess));
    if (r === "ok") {
      haptic.success();
      flash(t("ttkScoutRight").replace("{name}", scoutPlayer.name));
      setScout(null);
    } else setScoutMsg(r === "gold" ? t("ttkNoGold") : t("ttkBenchFull"));
  };
  const buyScoutFull = () => {
    if (scout === null) return;
    const r = act((l) => buy(l, me, scout));
    if (r === "ok") setScout(null);
    else setScoutMsg(r === "gold" ? t("ttkNoGold") : t("ttkBenchFull"));
  };

  const traitLabel = (x: TraitState) => {
    if (x.kind === "club") {
      const c = clubCriterion(x.id);
      return c ? (locale === "tr" ? c.tr : c.en) : x.id;
    }
    if (x.kind === "country") {
      const c = COUNTRY.get(x.id);
      return c ? (locale === "tr" ? c.tr : c.en) : x.id.charAt(0).toUpperCase() + x.id.slice(1);
    }
    return t(`ttkHonour_${x.id as "wc"}`);
  };
  const traitDesc = (x: TraitState) =>
    x.kind === "club" ? t("ttkClubTrait") : x.kind === "country" ? t(STYLES[x.id] ? (`ttkStyle_${x.id}` as "ttkStyle_brazil") : "ttkStyle_other") : traitLabel(x);
  const traitIcon = (x: TraitState) => {
    if (x.kind === "club") {
      const c = clubCriterion(x.id);
      return c ? <ClubShirt c={c} size={16} /> : null;
    }
    if (x.kind === "country") return <Flag id={x.id} width={20} />;
    return <Text style={{ fontSize: 14 }}>{({ wc: "🏆", ucl: "⭐", ballon: "🥇", euro: "🌍" } as Record<string, string>)[x.id]}</Text>;
  };

  const startMatch = () => {
    setSel(null);
    haptic.press();
    kickOff();
    setMatch(true);
  };

  const standings = lobby.managers.slice().sort((a, b) => (a.place ?? 0) - (b.place ?? 0) || b.hp - a.hp);
  const xpNeed = xpToNext(me);

  return (
    <View style={{ flex: 1, backgroundColor: C.greenDark }}>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + 4 }]}>
        <View style={styles.topRow}>
          <Tap onPress={() => router.back()} style={styles.back} accessibilityLabel="‹">
            <Icon name="chevron.left" size={18} color="white" fallback="‹" />
          </Tap>
          <Text style={styles.stage}>
            {t("ttkStage").replace("{s}", String(lobby.stage)).replace("{r}", String(lobby.round + 1))}
            {roundKind(lobby) === "pve" ? ` · ${t("ttkFriendly")}` : ""}
          </Text>
          <View ref={tour.ref("hp")} collapsable={false} style={styles.stat}>
            <Icon name="heart.fill" size={14} color="#FF5A6E" fallback="♥" />
            <Text style={styles.statText}>{Math.max(0, me.hp)}</Text>
          </View>
          <View ref={tour.ref("gold")} collapsable={false} style={styles.stat}>
            <Text style={{ fontSize: 13 }}>🪙</Text>
            <Text style={styles.statText}>{me.gold}</Text>
          </View>
          {/* a streak of 2+ pays extra gold each round: show it */}
          {Math.abs(me.streak) >= 2 && (
            <Tap
              onPress={() => flash(t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak)))))}
              style={[styles.stat, { backgroundColor: me.streak > 0 ? "rgba(249,115,22,0.35)" : "rgba(96,165,250,0.3)" }]}
              accessibilityLabel={t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak))))}
            >
              <Text style={{ fontSize: 12 }}>{me.streak > 0 ? "🔥" : "🧊"}</Text>
              <Text style={styles.statText}>{Math.abs(me.streak)}</Text>
            </Tap>
          )}
          <Tap onPress={tour.start} style={styles.back} accessibilityLabel={t("ttkHowTo")}>
            <Icon name="questionmark" size={16} color="white" fallback="?" />
          </Tap>
        </View>
        {/* everyone's health */}
        <View ref={tour.ref("table")} collapsable={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.table}>
          {standings.map((m) => (
            <View key={m.id} style={[styles.mgr, m.id === me.id && styles.mgrMe, m.place !== null && { opacity: 0.35 }]}>
              <Text style={styles.mgrName} numberOfLines={1}>
                {m.id === me.id ? t("you") : m.name}
              </Text>
              <View style={styles.mgrBar}>
                <View style={[styles.mgrFill, { width: `${Math.max(0, m.hp)}%`, backgroundColor: m.hp > 50 ? "#4ADE80" : m.hp > 25 ? "#FACC15" : "#F87171" }]} />
              </View>
            </View>
          ))}
        </ScrollView>
        </View>
      </View>

      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        {/* the pitch */}
        <View ref={tour.ref("pitch")} collapsable={false}>
        <Pressable onPress={() => setSel(null)} style={[styles.pitch, { marginHorizontal: 12 }]}>
          <View style={styles.pitchLine} />
          <View style={styles.circle} />
          {ROWS.map((zone) => (
            <View key={zone} style={styles.row}>
              {SLOTS.map((z, i) => (z === zone ? i : -1))
                .filter((i) => i >= 0)
                .map((slot) => {
                  const u = me.units.find((x) => x.slot === slot);
                  return u ? (
                    <UnitCard key={slot} unit={u} width={cardW} selected={sel?.kind === "unit" && sel.uid === u.uid} onPress={() => tapUnit(u.uid)} />
                  ) : (
                    <Tap
                      key={slot}
                      onPress={() => tapSlot(slot)}
                      style={[styles.empty, { width: cardW, height: cardW * 1.12 }, sel?.kind === "unit" && styles.emptyLit]}
                      accessibilityLabel={t(`ttkPos_${zone}`)}
                    >
                      <Text style={styles.emptyText}>{t(`ttkPos_${zone}`)}</Text>
                    </Tap>
                  );
                })}
            </View>
          ))}
          <View style={styles.capPill}>
            <Text style={styles.capText}>{t("ttkOnPitch").replace("{n}", String(onPitch.length)).replace("{m}", String(cap))}</Text>
          </View>
        </Pressable>
        </View>

        {/* synergies */}
        <View ref={tour.ref("traits")} collapsable={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.traits}>
          {traits.length === 0 && <Text style={styles.hint}>{t("ttkNoTraits")}</Text>}
          {traits.map((x) => (
            <Tap key={`${x.kind}-${x.id}`} onPress={() => setInfo(x)} style={[styles.trait, x.tier > 0 && styles.traitOn]} accessibilityLabel={traitLabel(x)}>
              {traitIcon(x)}
              <Text style={[styles.traitText, x.tier > 0 && { color: C.greenDark }]}>
                {x.count}/{x.steps[Math.min(x.tier, x.steps.length - 1)]}
              </Text>
            </Tap>
          ))}
        </ScrollView>
        </View>

        {/* items */}
        {me.items.length > 0 && (
          <View style={styles.itemsRow}>
            <Text style={styles.label}>{t("ttkItems")}</Text>
            {me.items.map((it, i) => (
              <Tap key={i} onPress={() => setSel(sel?.kind === "item" && sel.index === i ? null : { kind: "item", index: i })} style={[styles.item, sel?.kind === "item" && sel.index === i && styles.itemOn]} accessibilityLabel={t(`ttkI_${it}`)}>
                <ItemIcon id={it} size={30} />
              </Tap>
            ))}
            {sel?.kind === "item" && <Text style={styles.hint}>{t(`ttkId_${me.items[sel.index]}`)}</Text>}
          </View>
        )}

        {/* bench */}
        <View ref={tour.ref("bench")} collapsable={false}>
        <Pressable onPress={tapBench} style={styles.benchWrap}>
          <Text style={styles.label}>
            {t("ttkBench")} {bench(me).length}/8
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bench}>
            {bench(me).map((u) => (
              <UnitCard key={u.uid} unit={u} width={benchW} selected={sel?.kind === "unit" && sel.uid === u.uid} onPress={() => tapUnit(u.uid)} />
            ))}
            {Array.from({ length: Math.max(0, 8 - bench(me).length) }, (_, i) => (
              <Pressable key={`e${i}`} onPress={tapBench} style={[styles.benchEmpty, { width: benchW, height: benchW * 1.12 }]} />
            ))}
          </ScrollView>
        </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 6 }]}>
        <View style={styles.noteSlot}>{note ?? incomeNote ? <Animated.Text entering={FadeIn} style={styles.note}>{note ?? incomeNote}</Animated.Text> : <Text style={styles.hint}>{t("ttkHint")}</Text>}</View>

        {/* shop, or sell while a player is picked */}
        {selectedUnit ? (
          <Tap
            onPress={() => {
              act((l) => sell(l, me, selectedUnit.uid));
              haptic.success();
              setSel(null);
            }}
            style={[styles.sell, { marginHorizontal: 12 }]}
          >
            <Icon name="dollarsign.circle.fill" size={22} color="white" fallback="$" />
            <Text style={styles.sellText}>{t("ttkSell").replace("{g}", String(sellValue(selectedUnit)))}</Text>
          </Tap>
        ) : (
          <View ref={tour.ref("shop")} collapsable={false} style={styles.shop}>
            {me.shop.map((card, i) => {
              if (!card) return <View key={i} style={{ width: shopW }} />;
              const p = lobby.players[card.pid];
              const owned = me.units.filter((u) => u.pid === p.pid && u.star === 1).length;
              const club = clubCriterion(p.club);
              if (card.scout)
                return (
                  <Tap key={i} onPress={() => tapShop(i, card)} style={[styles.shopCard, { width: shopW, borderColor: "#7C3AED" }]} accessibilityLabel={t("ttkScoutTitle")}>
                    <Image source={TAKTIK.scout} style={{ width: shopW * 0.62, height: shopW * 0.62 }} />
                    <View style={styles.clues}>
                      <Flag id={p.country} width={18} />
                      {club && <ClubShirt c={club} size={12} />}
                      <PosTag pos={p.pos} small />
                    </View>
                    <View style={[styles.price, { backgroundColor: "#7C3AED" }]}>
                      <Text style={styles.priceText}>🪙 {p.cost}</Text>
                    </View>
                  </Tap>
                );
              return (
                <View key={i} style={{ width: shopW }}>
                  <UnitCard unit={{ ...p, star: 1, items: [] }} width={shopW} dim={me.gold < p.cost} onPress={() => tapShop(i, card)} />
                  <View style={[styles.price, { backgroundColor: COST_COLOR[p.cost] }]}>
                    <Text style={styles.priceText}>🪙 {p.cost}</Text>
                  </View>
                  {owned > 0 && (
                    <View style={styles.owned}>
                      <Text style={styles.ownedText}>{owned}/3</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.actions}>
          <View ref={tour.ref("reroll")} collapsable={false} style={{ flex: 1 }}>
          <Tap onPress={() => (act((l) => reroll(l, me)) ? haptic.tap() : flash(t("ttkNoGold")))} style={styles.small} accessibilityLabel={t("ttkReroll")}>
            <Icon name="arrow.clockwise" size={16} color="white" fallback="↻" />
            <Text style={styles.smallText}>
              {t("ttkReroll")} · {REROLL_COST}
            </Text>
          </Tap>
          </View>
          <View ref={tour.ref("xp")} collapsable={false} style={{ flex: 1 }}>
          <Tap onPress={() => (act(() => buyXp(me)) ? haptic.tap() : flash(t("ttkNoGold")))} style={styles.small} accessibilityLabel={t("ttkBuyXp")}>
            <Text style={styles.smallText}>
              {t("ttkLevel").replace("{n}", String(me.level))} {xpNeed ? `${me.xp}/${xpNeed}` : ""}
            </Text>
            <Text style={styles.smallSub}>
              {t("ttkBuyXp")} · {XP_COST}
            </Text>
          </Tap>
          </View>
          <View ref={tour.ref("kick")} collapsable={false} style={{ flex: 1 }}>
          <Tap onPress={startMatch} style={[styles.small, styles.kick]} accessibilityLabel={t("ttkPlayMatch")}>
            <Icon name="play.fill" size={16} color="#3B2A05" fallback="▶" />
            <Text style={[styles.smallText, { color: "#3B2A05" }]}>{t("ttkPlayMatch")}</Text>
          </Tap>
          </View>
        </View>
      </View>

      {/* synergy info */}
      <Modal visible={!!info} transparent animationType="fade" onRequestClose={() => setInfo(null)}>
        <Pressable style={styles.backdrop} onPress={() => setInfo(null)}>
          {info && (
            <Animated.View entering={ZoomIn.duration(180)} style={styles.infoCard}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {traitIcon(info)}
                <Text style={T.headline}>{traitLabel(info)}</Text>
              </View>
              <Text style={T.body}>{traitDesc(info)}</Text>
              <Text style={T.caption}>{info.steps.map((s, i) => (i < info.tier ? `✓ ${s}` : String(s))).join("  ·  ")}</Text>
            </Animated.View>
          )}
        </Pressable>
      </Modal>

      {/* scout report */}
      <Modal visible={scout !== null} transparent animationType="slide" onRequestClose={() => setScout(null)}>
        <Pressable style={styles.backdrop} onPress={() => setScout(null)} />
        {scoutPlayer && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <Image source={TAKTIK.scout} style={{ width: 90, height: 90 }} />
              <Text style={T.title}>{t("ttkScoutTitle")}</Text>
              <Text style={[T.body, { textAlign: "center" }]}>{t("ttkScoutHint").replace("{n}", String(SCOUT_DISCOUNT))}</Text>
              <View style={styles.cluesBig}>
                <Flag id={scoutPlayer.country} width={36} />
                {clubCriterion(scoutPlayer.club) && <ClubShirt c={clubCriterion(scoutPlayer.club)!} size={26} />}
                <PosTag pos={scoutPlayer.pos} />
                <View style={[styles.price, { position: "relative", backgroundColor: COST_COLOR[scoutPlayer.cost] }]}>
                  <Text style={styles.priceText}>🪙 {scoutPlayer.cost}</Text>
                </View>
              </View>
            </View>
            <TextInput
              value={guess}
              onChangeText={(v) => {
                setGuess(v);
                setScoutMsg(null);
              }}
              onSubmitEditing={tryScout}
              placeholder={t("ttkScoutGuess")}
              placeholderTextColor={C.text3}
              autoCorrect={false}
              autoFocus
              style={styles.input}
            />
            {scoutMsg && <Text style={[T.caption, { color: C.red, fontWeight: "700", textAlign: "center" }]}>{scoutMsg}</Text>}
            <Button title={`${t("ttkScoutTry")} · ${priceOf(lobby, scoutPlayer.pid, true)}`} kind="gold" onPress={tryScout} />
            <Button title={t("ttkScoutFull").replace("{g}", String(scoutPlayer.cost))} kind="secondary" onPress={buyScoutFull} />
          </View>
        )}
      </Modal>

      {/* tactics card offer */}
      <Modal visible={!!me.offer && !match && !out} transparent animationType="fade">
        <View style={[styles.backdrop, { justifyContent: "center", padding: 20 }]}>
          <View style={styles.offer}>
            <Text style={[T.title, { textAlign: "center" }]}>{t("ttkAugTitle")}</Text>
            {me.offer?.map((a, i) => (
              <Tap key={a} onPress={() => act((l) => chooseAugment(l, me, i))} style={styles.aug} accessibilityLabel={t(`ttkA_${a}`)}>
                <Text style={T.headline}>{t(`ttkA_${a}`)}</Text>
                <Text style={T.caption}>{t(`ttkAd_${a}`)}</Text>
              </Tap>
            ))}
          </View>
        </View>
      </Modal>

      {match && <MatchView lobby={lobby} meId={me.id} onClose={() => setMatch(false)} />}

      {/* out of the game */}
      {out && !match && (
        <View style={[StyleSheet.absoluteFill, styles.backdrop, { justifyContent: "center", padding: 24 }]}>
          <Animated.View entering={ZoomIn.duration(260)} style={styles.offer}>
            <Image source={TAKTIK.hero} style={{ width: 120, height: 120, alignSelf: "center" }} />
            <Text style={[T.title, { textAlign: "center" }]}>{me.place === 1 ? t("ttkWinner") : t("ttkOver")}</Text>
            <Text style={[T.headline, { textAlign: "center" }]}>{t("ttkPlace").replace("{n}", String(me.place ?? alive(lobby).length))}</Text>
            {me.place === 1 && me.hp >= START_HP && <Text style={[T.caption, { textAlign: "center", color: C.greenMid, fontWeight: "800" }]}>{t("ttkFlawless")}</Text>}
            {/* everyone's final place, squad and best synergies */}
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 6 }}>
              {standings.map((m) => {
                const top = sheet({ name: m.name, units: m.units, coach: m.coach, augments: m.augments })
                  .traits.filter((x) => x.tier > 0)
                  .sort((a, b) => b.tier - a.tier || b.count - a.count)
                  .slice(0, 3);
                return (
                  <View key={m.id} style={[styles.finalRow, m.id === me.id && styles.finalMe]}>
                    <Text style={styles.finalPlace}>{m.place ?? 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={T.headline} numberOfLines={1}>
                        {m.id === me.id ? t("you") : m.name}
                      </Text>
                      <Text style={T.caption} numberOfLines={1}>
                        {t("ttkOnPitchN").replace("{n}", String(fielded(m).length))}
                      </Text>
                    </View>
                    <View style={styles.finalTraits}>
                      {top.map((x) => (
                        <View key={`${x.kind}-${x.id}`} style={styles.finalTrait}>
                          {traitIcon(x)}
                          <Text style={styles.finalTraitText}>{x.count}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Button
              title={t("ttkNewGame")}
              onPress={() => {
                quitTaktik();
                if (router.canGoBack()) router.back();
                else router.replace("/taktik");
              }}
            />
          </Animated.View>
        </View>
      )}

      {!out && !match && <TourOverlay tour={tour} />}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: "#0B3D22", paddingHorizontal: 12, paddingBottom: 8 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, fontFamily: F.display, fontSize: 20, color: "white" },
  stat: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.25)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statText: { fontFamily: F.display, fontSize: 17, color: "white" },
  table: { gap: 6, paddingTop: 8 },
  mgr: { width: 66, gap: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, padding: 5 },
  mgrMe: { backgroundColor: "rgba(250,204,21,0.25)" },
  mgrName: { color: "white", fontSize: 10, fontWeight: "700" },
  mgrBar: { height: 4, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.35)", overflow: "hidden" },
  mgrFill: { height: 4, borderRadius: 2 },
  pitch: { marginTop: 10, backgroundColor: C.pitchA, borderRadius: 18, padding: 8, gap: 8, borderWidth: 2, borderColor: C.pitchLine, overflow: "hidden" },
  pitchLine: { position: "absolute", left: 0, right: 0, top: "48%", height: 2, backgroundColor: C.pitchLine },
  circle: { position: "absolute", alignSelf: "center", top: "39%", width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: C.pitchLine },
  row: { flexDirection: "row", justifyContent: "center", gap: 6 },
  empty: { borderRadius: 10, borderWidth: 2, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.45)", alignItems: "center", justifyContent: "center" },
  emptyLit: { borderColor: "#FACC15", backgroundColor: "rgba(250,204,21,0.12)" },
  emptyText: { fontFamily: F.display, fontSize: 14, color: "rgba(255,255,255,0.7)" },
  capPill: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.35)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  capText: { color: "white", fontSize: 11, fontWeight: "700" },
  traits: { gap: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  trait: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  traitOn: { backgroundColor: "#BBF7D0" },
  traitText: { fontFamily: F.display, fontSize: 14, color: "white" },
  itemsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, flexWrap: "wrap" },
  item: { width: 40, height: 40, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  itemOn: { backgroundColor: "#FACC15" },
  label: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "800", marginRight: 4 },
  benchWrap: { paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  bench: { gap: 6 },
  benchEmpty: { borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  noteSlot: { height: 26, justifyContent: "center", paddingHorizontal: 12 },
  note: { color: "#FDE68A", fontWeight: "800", fontSize: 13, textAlign: "center" },
  hint: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center" },
  shop: { flexDirection: "row", gap: 6, paddingHorizontal: 12 },
  shopCard: { borderRadius: 10, borderWidth: 3, backgroundColor: "#EDE7FF", alignItems: "center", paddingTop: 6, aspectRatio: 1 / 1.12 },
  clues: { flexDirection: "row", alignItems: "center", gap: 3 },
  cluesBig: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  price: { position: "absolute", bottom: -8, alignSelf: "center", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  priceText: { color: "white", fontWeight: "800", fontSize: 11 },
  owned: { position: "absolute", top: 14, left: 3, backgroundColor: "#FACC15", borderRadius: 6, paddingHorizontal: 4 },
  ownedText: { fontSize: 10, fontWeight: "900", color: "#3B2A05" },
  sell: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.red, borderRadius: 14, height: 70 },
  sellText: { fontFamily: F.display, fontSize: 22, color: "white" },
  footer: { backgroundColor: "#0B3D22", paddingTop: 2 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginTop: 14 },
  kick: { backgroundColor: "#FACC15", flexDirection: "row", gap: 6 },
  // the walkthrough wraps each button in a flex: 1 box (the width); the button keeps its own height
  small: { minHeight: 50, alignItems: "center", justifyContent: "center", gap: 2, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, paddingVertical: 8, flexDirection: "column" },
  smallText: { fontFamily: F.display, fontSize: 16, color: "white" },
  smallSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  infoCard: { margin: 24, marginTop: "60%", backgroundColor: C.card, borderRadius: 18, padding: 16, gap: 8 },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, gap: 10 },
  input: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, height: 50, fontSize: 18, color: C.text },
  offer: { backgroundColor: C.bg, borderRadius: 22, padding: 18, gap: 10 },
  finalRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  finalMe: { borderWidth: 2, borderColor: C.green },
  finalPlace: { width: 22, fontFamily: F.display, fontSize: 20, color: C.text2, textAlign: "center" },
  finalTraits: { flexDirection: "row", gap: 4 },
  finalTrait: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.greenSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 3 },
  finalTraitText: { fontFamily: F.display, fontSize: 13, color: C.greenDark },
  aug: { backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 2, borderWidth: 2, borderColor: C.border },
});
