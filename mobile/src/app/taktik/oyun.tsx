import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { XP } from "@/lib/levels";
import { ALL_CRITERIA } from "@/lib/tiki";
import { alive, autoArrange, bench, buy, buyXp, chooseAugment, fillField, rerollAugment, equip, fieldCap, fielded, move, namesPlayer, priceOf, reroll, roundKind, sell, sellValue, xpToNext } from "@/lib/taktik/engine";
import { INCOME, INTEREST_STEP, planSeconds, REROLL_COST, SCOUT_DISCOUNT, SLOTS, START_HP, streakGold, XP_COST, type Pos } from "@/lib/taktik/rules";
import { sheet } from "@/lib/taktik/sim";
import { STYLES, type TraitState } from "@/lib/taktik/traits";
import type { Manager, ShopCard } from "@/lib/taktik/types";

import { FocusStatusBar } from "~/components/StadiumHeader";
import { Flag } from "~/components/Flag";
import { ClubShirt } from "~/components/HatTrickBoard";
import { COST_COLOR, ItemIcon, PosTag, UnitCard, clubCriterion } from "~/components/taktik/Card";
import { avatarsOf, LobbyIntro } from "~/components/taktik/LobbyIntro";
import { Avatar } from "~/components/Avatar";
import { PlanClock } from "~/components/taktik/PlanClock";
import { TacticsCard, TacticsChips } from "~/components/taktik/TacticsCard";
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

/**
 * One Taktik Tahtası game: health table, the pitch (12 spots by zone), synergies,
 * items, the bench, the shop and the buttons. Tap a player, then a spot.
 */
/** seed of the game whose intro has played (kept while the app runs) */
let introShown = -1;

export default function TaktikGame() {
  // the engine mutates the lobby in place: no compiler memoization here
  "use no memo";
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { lobby } = useTaktik();
  const [sel, setSel] = useState<Sel>(null);
  const [note, setNote] = useState<string | null>(null);
  const [match, setMatch] = useState(false);
  const [scout, setScout] = useState<number | null>(null);
  const [guess, setGuess] = useState("");
  const [scoutMsg, setScoutMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<TraitState | null>(null);
  /** the tactics card just tapped: it lights up for a moment before it's taken */
  const [augPick, setAugPick] = useState<number | null>(null);
  /** height left for the board between the top bar and the shop (the pitch fits into it) */
  const [boardH, setBoardH] = useState(0);
  /** the lobby intro was seen for this game (seed) */
  const [introSeen, setIntroSeen] = useState(() => introShown);
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

  const augW = Math.min(150, (width - 24 - 20) / 3);
  const showIntro = introSeen !== lobby.seed && lobby.played === 0 && lobby.stage === 1 && lobby.round === 0;
  const pickAugment = (i: number) => {
    haptic.success();
    setAugPick(i);
    setTimeout(() => {
      act((l) => chooseAugment(l, me, i));
      // a card that brings players (Academy, Star signing) walks them onto the pitch too
      act(() => fillField(me));
      setAugPick(null);
    }, 650);
  };

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
    else {
      // straight onto the pitch while there's room (the manager's own placements stay)
      act(() => fillField(me));
      haptic.success();
    }
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
    if (r === "ok") act(() => fillField(me));
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

  // the toy pitch: where its playing area sits in the picture (a trapezoid, narrower at the far end)
  // the pitch takes what's left once the rows around it are laid out, so everything fits on one screen
  const benchSlotW = (width - 24 - 7 * 5) / 8;
  const around = 52 + 46 + 50 + benchSlotW * 1.12 + 14;
  const pitchImgH = Math.max(220, Math.min((width - 24) * (921 / 914), (boardH || height * 0.55) - around));
  const pitchImgW = pitchImgH * (914 / 921);
  // the touchlines in the picture, as fractions of it (measured from pitch-toy.png)
  const FIELD = { top: 0.1, bottom: 0.84, topL: 0.172, topR: 0.8, botL: 0.068, botR: 0.893 };
  const LINE_V: Record<Pos, number> = { FWD: 0.12, MID: 0.38, DEF: 0.64, GK: 0.9 };
  const LINE_U: Record<number, number[]> = { 1: [0.5], 3: [0.18, 0.5, 0.82], 4: [0.12, 0.37, 0.63, 0.88] };
  const spot = (slot: number) => {
    const zone = SLOTS[slot];
    const inZone = SLOTS.map((z, i) => (z === zone ? i : -1)).filter((i) => i >= 0);
    const v = LINE_V[zone];
    const u = LINE_U[inZone.length][inZone.indexOf(slot)];
    const l = FIELD.topL + (FIELD.botL - FIELD.topL) * v;
    const r = FIELD.topR + (FIELD.botR - FIELD.topR) * v;
    const scale = 0.84 + 0.2 * v;
    return { x: (l + (r - l) * u) * pitchImgW, y: (FIELD.top + (FIELD.bottom - FIELD.top) * v) * pitchImgH, w: pitchImgW * 0.15 * scale };
  };
  const looks = avatarsOf(lobby.managers, me.id);
  const shopCardW = (width - 24 - 4 * 8) / 5;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusStatusBar style="dark" />
      {/* top bar: back, the round, health / gold / streak as little 3D counters, the set-up clock */}
      <View style={[styles.top, { paddingTop: insets.top + 2 }]}>
        <View style={styles.topRow}>
          <Tap onPress={() => router.back()} style={styles.back} accessibilityLabel="‹">
            <Icon name="arrow.left" size={20} color={C.text} fallback="‹" />
          </Tap>
          <Text style={styles.stage} numberOfLines={1}>
            {t("ttkStage").replace("{s}", String(lobby.stage)).replace("{r}", String(lobby.round + 1))}
            {roundKind(lobby) === "pve" ? ` · ${t("ttkFriendly")}` : ""}
          </Text>
          <View ref={tour.ref("hp")} collapsable={false} style={styles.stat}>
            <Image source={TAKTIK.ui.heart} style={styles.statIcon} />
            <Text style={styles.statText}>{Math.max(0, me.hp)}</Text>
          </View>
          <View ref={tour.ref("gold")} collapsable={false} style={styles.stat}>
            <Image source={TAKTIK.ui.coin} style={styles.statIcon} />
            <Text style={styles.statText}>{me.gold}</Text>
          </View>
          {/* a streak of 2+ pays extra gold each round: show it */}
          {Math.abs(me.streak) >= 2 && (
            <Tap
              onPress={() => flash(t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak)))))}
              style={styles.stat}
              accessibilityLabel={t(me.streak > 0 ? "ttkWinStreak" : "ttkLossStreak").replace("{n}", String(Math.abs(me.streak))).replace("{g}", String(streakGold(Math.abs(me.streak))))}
            >
              {me.streak > 0 ? <Image source={TAKTIK.ui.flame} style={styles.statIcon} /> : <Text style={{ fontSize: 15 }}>🧊</Text>}
              <Text style={styles.statText}>{Math.abs(me.streak)}</Text>
            </Tap>
          )}
          <Tap onPress={tour.start} style={styles.help} accessibilityLabel={t("ttkHowTo")}>
            <Icon name="questionmark" size={14} color={C.text2} fallback="?" />
          </Tap>
        </View>
        {/* the set-up clock: at zero the match kicks off (online, everyone at once); it waits while a walkthrough, the intro or a card pick is up */}
        <PlanClock
          key={`clock-${lobby.seed}-${roundKey}`}
          seconds={planSeconds(lobby.stage)}
          running={!match && !out && !showIntro && tour.step === null && augPick === null && scout === null}
          onEnd={startMatch}
        />
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 6 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onLayout={(e) => setBoardH(e.nativeEvent.layout.height)}
      >
        {/* everyone's health: round avatars with a bar under each */}
        <View ref={tour.ref("table")} collapsable={false} style={styles.table}>
          {standings.map((m) => (
            <View key={m.id} style={[styles.mgr, m.place !== null && { opacity: 0.35 }]}>
              <Avatar id={m.id === me.id ? null : (looks.get(m.id) ?? null)} me={m.id === me.id} size={34} ring={m.id === me.id ? C.green : "white"} />
              <View style={styles.mgrBar}>
                <View style={[styles.mgrFill, { width: `${Math.max(0, m.hp)}%`, backgroundColor: m.hp > 50 ? C.green : m.hp > 25 ? "#F59E0B" : C.red }]} />
              </View>
            </View>
          ))}
        </View>

        {/* the pitch: a toy pitch with the twelve spots set out in perspective */}
        <View ref={tour.ref("pitch")} collapsable={false}>
          <Pressable onPress={() => setSel(null)} style={{ width: pitchImgW, height: pitchImgH, alignSelf: "center" }}>
            {/* explicit size: absoluteFill on an Image misrenders in RN */}
            <Image source={TAKTIK.ui.pitch} style={{ position: "absolute", left: 0, top: 0, width: pitchImgW, height: pitchImgH }} />
            {SLOTS.map((zone, slot) => {
              const p = spot(slot);
              const u = me.units.find((x) => x.slot === slot);
              const h = p.w * 1.12;
              return (
                <View key={slot} style={{ position: "absolute", left: p.x - p.w / 2, top: p.y - h / 2, width: p.w, height: h }}>
                  {u ? (
                    <UnitCard unit={u} width={p.w} selected={sel?.kind === "unit" && sel.uid === u.uid} onPress={() => tapUnit(u.uid)} />
                  ) : (
                    <Tap onPress={() => tapSlot(slot)} style={[styles.empty, { width: p.w, height: h }, sel?.kind === "unit" && styles.emptyLit]} accessibilityLabel={t(`ttkPos_${zone}`)}>
                      <Text style={styles.emptyText}>{t(`ttkPos_${zone}`)}</Text>
                    </Tap>
                  )}
                </View>
              );
            })}
          </Pressable>
        </View>

        {/* under the pitch: how many are on it, and one tap for the best side */}
        <View style={styles.pills}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t("ttkOnPitch").replace("{n}", String(onPitch.length)).replace("{m}", String(cap))}</Text>
          </View>
          <Tap
            onPress={() => {
              act(() => autoArrange(me));
              setSel(null);
              haptic.success();
            }}
            style={styles.pill}
            accessibilityLabel={t("ttkBestLineup")}
          >
            <Image source={TAKTIK.ui.wand} style={{ width: 16, height: 17 }} />
            <Text style={styles.pillText}>{t("ttkBestLineup")}</Text>
          </Tap>
        </View>

        {/* tactics cards and synergies, one row of pills */}
        <View ref={tour.ref("traits")} collapsable={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.traits}>
            {me.augments.length > 0 && <TacticsChips ids={me.augments} />}
            {traits.length === 0 && me.augments.length === 0 && <Text style={styles.hint}>{t("ttkNoTraits")}</Text>}
            {traits.map((x) => (
              <Tap key={`${x.kind}-${x.id}`} onPress={() => setInfo(x)} style={[styles.trait, x.tier > 0 && styles.traitOn]} accessibilityLabel={traitLabel(x)}>
                {traitIcon(x)}
                <Text style={[styles.traitText, x.tier > 0 && { color: "white" }]}>
                  {x.count}/{x.steps[Math.min(x.tier, x.steps.length - 1)]}
                </Text>
              </Tap>
            ))}
            {me.items.map((it, i) => (
              <Tap key={`i${i}`} onPress={() => setSel(sel?.kind === "item" && sel.index === i ? null : { kind: "item", index: i })} style={[styles.item, sel?.kind === "item" && sel.index === i && styles.itemOn]} accessibilityLabel={t(`ttkI_${it}`)}>
                <ItemIcon id={it} size={24} />
              </Tap>
            ))}
          </ScrollView>
          {sel?.kind === "item" && <Text style={[styles.hint, { marginTop: -2 }]}>{t(`ttkId_${me.items[sel.index]}`)}</Text>}
        </View>

        {/* the bench: eight slots in one row */}
        <View ref={tour.ref("bench")} collapsable={false}>
          <Pressable onPress={tapBench} style={styles.bench}>
            {Array.from({ length: 8 }, (_, i) => {
              const u = bench(me)[i];
              return u ? (
                <UnitCard key={u.uid} unit={u} width={benchSlotW} selected={sel?.kind === "unit" && sel.uid === u.uid} onPress={() => tapUnit(u.uid)} />
              ) : (
                <Pressable key={`e${i}`} onPress={tapBench} style={[styles.benchEmpty, { width: benchSlotW, height: benchSlotW * 1.12 }, sel?.kind === "unit" && styles.emptyLit]} />
              );
            })}
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 6 }]}>
        {/* one short line: the round's gold, or what just happened; the how-to hint only on the first rounds */}
        <View style={styles.noteSlot}>
          {note ?? incomeNote ? (
            <Animated.Text entering={FadeIn} style={styles.note} numberOfLines={1}>
              {note ?? incomeNote}
            </Animated.Text>
          ) : lobby.played < 2 ? (
            <Text style={styles.hint} numberOfLines={1} adjustsFontSizeToFit>
              {t("ttkHint")}
            </Text>
          ) : null}
        </View>

        {/* the shop: five cards, the price under each */}
        <View ref={tour.ref("shop")} collapsable={false} style={styles.shop}>
          {me.shop.map((card, i) => {
            if (!card) return <View key={i} style={{ width: shopCardW }} />;
            const p = lobby.players[card.pid];
            const owned = me.units.filter((u) => u.pid === p.pid && u.star === 1).length;
            return (
              <View key={i} style={{ width: shopCardW, alignItems: "center", gap: 5 }}>
                {card.scout ? (
                  <Tap onPress={() => tapShop(i, card)} style={[styles.scoutCard, { width: shopCardW, height: shopCardW * 1.12 }]} accessibilityLabel={t("ttkScoutTitle")}>
                    <Image source={TAKTIK.ui.scout} style={{ width: shopCardW * 0.86, height: shopCardW * 0.97 }} resizeMode="contain" />
                  </Tap>
                ) : (
                  <UnitCard unit={{ ...p, star: 1, items: [] }} width={shopCardW} dim={me.gold < p.cost} onPress={() => tapShop(i, card)} />
                )}
                <View style={styles.price}>
                  <Image source={TAKTIK.ui.coin} style={{ width: 15, height: 15 }} />
                  <Text style={styles.priceText}>{p.cost}</Text>
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

        {/* buttons: sell while a player is picked; else reroll, buy XP and the one big Kick off */}
        {selectedUnit ? (
          <Tap
            onPress={() => {
              act((l) => sell(l, me, selectedUnit.uid));
              haptic.success();
              setSel(null);
            }}
            style={[styles.chunky, styles.sell]}
          >
            <Image source={TAKTIK.ui.coin} style={{ width: 26, height: 26 }} />
            <Text style={styles.sellText}>{t("ttkSell").replace("{g}", String(sellValue(selectedUnit)))}</Text>
          </Tap>
        ) : (
          <>
            <View style={styles.actions}>
              <View ref={tour.ref("reroll")} collapsable={false} style={{ flex: 1 }}>
                <Tap onPress={() => (act((l) => reroll(l, me)) ? haptic.tap() : flash(t("ttkNoGold")))} style={[styles.chunky, styles.reroll]} accessibilityLabel={t("ttkReroll")}>
                  <Image source={TAKTIK.ui.reroll} style={{ width: 22, height: 21 }} />
                  <Text style={styles.rerollText}>
                    {t("ttkReroll")} · {REROLL_COST}
                  </Text>
                  <Image source={TAKTIK.ui.coin} style={{ width: 15, height: 15 }} />
                </Tap>
              </View>
              <View ref={tour.ref("xp")} collapsable={false} style={{ flex: 1 }}>
                <Tap onPress={() => (act(() => buyXp(me)) ? haptic.tap() : flash(t("ttkNoGold")))} style={[styles.chunky, styles.xpBtn]} accessibilityLabel={t("ttkBuyXp")}>
                  <Text style={styles.xpText}>
                    {t("ttkLevel").replace("{n}", String(me.level))} · {t("ttkBuyXp")} {XP_COST}
                  </Text>
                  <View style={styles.xpTrack}>
                    <View style={[styles.xpFill, { width: `${xpNeed ? (me.xp / xpNeed) * 100 : 100}%` }]} />
                  </View>
                </Tap>
              </View>
            </View>
            <View ref={tour.ref("kick")} collapsable={false}>
              <Tap onPress={startMatch} style={[styles.chunky, styles.kick]} accessibilityLabel={t("ttkPlayMatch")}>
                <Image source={TAKTIK.ui.ball} style={{ width: 30, height: 31 }} />
                <Text style={styles.kickText}>{t("ttkPlayMatch")}</Text>
              </Tap>
            </View>
          </>
        )}
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

      {/* tactics card offer: three tall cards, a swap under each, the pick lights up and is taken */}
      <Modal visible={!!me.offer && !match && !out} transparent animationType="fade">
        <View style={styles.augScreen}>
          <View style={styles.augHead}>
            <View style={styles.augLine} />
            <Text style={styles.augTitle}>{t("ttkAugTitle")}</Text>
            <View style={styles.augLine} />
          </View>
          <Text style={styles.augHint}>{t("ttkAugHint").replace("{n}", String(me.offerRerolls ?? 0))}</Text>
          <View style={styles.augRow}>
            {me.offer?.map((a, i) => (
              <Animated.View key={`${a}-${i}`} entering={FadeInDown.delay(i * 90).duration(260)} style={{ alignItems: "center", gap: 12 }}>
                <TacticsCard
                  id={a}
                  width={augW}
                  state={augPick === null ? "idle" : augPick === i ? "picked" : "faded"}
                  onPress={augPick === null ? () => pickAugment(i) : undefined}
                />
                <Tap
                  onPress={() => (act((l) => rerollAugment(l, me, i)) ? haptic.tap() : flash(t("ttkAugNoSwaps")))}
                  disabled={augPick !== null || !me.offerRerolls}
                  style={[styles.augSwap, (!me.offerRerolls || augPick !== null) && { opacity: 0.35 }]}
                  accessibilityLabel={t("ttkAugSwap")}
                >
                  <Icon name="arrow.triangle.2.circlepath" size={13} color="white" fallback="↻" />
                  <Text style={styles.augSwapText}>{t("ttkAugSwap")}</Text>
                </Tap>
              </Animated.View>
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
              {standings.map((m, i) => {
                const top = sheet({ name: m.name, units: m.units, coach: m.coach, augments: m.augments })
                  .traits.filter((x) => x.tier > 0)
                  .sort((a, b) => b.tier - a.tier || b.count - a.count)
                  .slice(0, 3);
                return (
                  <View key={m.id} style={[styles.finalRow, m.id === me.id && styles.finalMe]}>
                    {/* still playing: their place is where they stand now (by health) */}
                    <Text style={styles.finalPlace}>{m.place ?? i + 1}</Text>
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

      {/* a new game opens on the eight managers' cards (first round only, once per game) */}
      {showIntro ? (
        <LobbyIntro
          managers={lobby.managers}
          meId={me.id}
          onDone={() => {
            introShown = lobby.seed;
            setIntroSeen(lobby.seed);
          }}
        />
      ) : (
        !out && !match && <TourOverlay tour={tour} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: C.card, paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  back: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  help: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, fontFamily: F.display, fontSize: 20, color: C.text },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statIcon: { width: 22, height: 22, resizeMode: "contain" },
  statText: { fontFamily: F.display, fontSize: 18, color: C.text },
  table: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  mgr: { alignItems: "center", gap: 4 },
  mgrBar: { width: 30, height: 4, borderRadius: 2, backgroundColor: C.key, overflow: "hidden" },
  mgrFill: { height: 4, borderRadius: 2 },
  empty: { borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.85)", backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  emptyLit: { borderColor: "#FACC15", backgroundColor: "rgba(250,204,21,0.25)" },
  emptyText: { fontFamily: F.display, fontSize: 13, color: "white" },
  pills: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 4 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: C.border, borderBottomWidth: 3 },
  pillText: { fontFamily: F.display, fontSize: 15, color: C.text },
  traits: { gap: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  trait: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  traitOn: { backgroundColor: C.green, borderColor: C.green },
  traitText: { fontFamily: F.display, fontSize: 14, color: C.text },
  item: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  itemOn: { backgroundColor: "#FEF3C7", borderColor: "#FACC15" },
  bench: { flexDirection: "row", gap: 5, paddingHorizontal: 12 },
  benchEmpty: { borderRadius: 9, backgroundColor: C.key },
  noteSlot: { height: 22, justifyContent: "center", paddingHorizontal: 12 },
  note: { color: C.greenMid, fontWeight: "800", fontSize: 13, textAlign: "center" },
  hint: { color: C.text3, fontSize: 12, textAlign: "center" },
  shop: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  cluesBig: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  scoutCard: { borderRadius: 10, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#A78BFA" },
  price: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: C.border },
  priceText: { fontFamily: F.display, fontSize: 14, color: C.text },
  owned: { position: "absolute", top: -6, left: -4, backgroundColor: C.text, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1 },
  ownedText: { fontSize: 10, fontWeight: "900", color: "white" },
  footer: { backgroundColor: C.bg, paddingTop: 0, gap: 8 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, marginTop: 4 },
  // Duolingo-style chunky buttons: a darker bottom edge instead of a shadow
  chunky: { minHeight: 50, borderRadius: 14, borderBottomWidth: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10 },
  reroll: { backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border, borderBottomColor: "#D3DBD6", borderBottomWidth: 4 },
  rerollText: { fontFamily: F.display, fontSize: 17, color: C.text },
  xpBtn: { backgroundColor: "#2563EB", borderBottomColor: "#1E40AF", flexDirection: "column", gap: 5 },
  xpText: { fontFamily: F.display, fontSize: 15, color: "white" },
  xpTrack: { alignSelf: "stretch", height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)", overflow: "hidden" },
  xpFill: { height: 6, borderRadius: 3, backgroundColor: "white" },
  kick: { marginHorizontal: 12, minHeight: 58, backgroundColor: "#FACC15", borderBottomColor: "#CA8A04", gap: 10 },
  kickText: { fontFamily: F.black, fontSize: 26, color: "#3B2A05" },
  sell: { marginHorizontal: 12, minHeight: 62, backgroundColor: "#F43F5E", borderBottomColor: "#BE123C", gap: 10 },
  sellText: { fontFamily: F.black, fontSize: 26, color: "white" },
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
  augScreen: { flex: 1, backgroundColor: "rgba(3,15,9,0.86)", justifyContent: "center", paddingHorizontal: 12 },
  augHead: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  augLine: { flex: 1, height: 1, backgroundColor: "rgba(253,230,138,0.5)" },
  augTitle: { fontFamily: F.display, fontSize: 26, color: "#FDE68A" },
  augHint: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 4 },
  augRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 22 },
  augSwap: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  augSwapText: { fontFamily: F.display, fontSize: 15, color: "white" },
});
