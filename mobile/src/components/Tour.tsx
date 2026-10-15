import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { C, F, T } from "~/lib/theme";

import { Text } from "./Text";
import { Tap } from "./ui";

export interface TourStep {
  /** the ref name the step points at (`tour.ref(name)`) */
  target: string;
  title: string;
  body: string;
  /** e.g. scroll the target into view; the step measures a moment later */
  before?: () => void;
}

type Rect = { x: number; y: number; w: number; h: number };

/**
 * A first-time walkthrough: the screen dims and only the part being explained
 * stays lit, with a short note and Next / Skip. Shown once per `id` (saved),
 * `start()` replays it (a "?" button).
 */
export function useTour(id: string, steps: TourStep[]) {
  const refs = useRef(new Map<string, View | null>());
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  // first visit: start once the screen has laid out
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(`tour-${id}`)
      .then((seen) => {
        if (!seen && alive) setTimeout(() => alive && setStep(0), 700);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (step === null) return;
    const s = steps[step];
    s?.before?.();
    const timer = setTimeout(
      () =>
        refs.current.get(s?.target ?? "")?.measureInWindow((x, y, w, h) => {
          setRect(w > 0 ? { x, y, w, h } : null);
        }),
      s?.before ? 380 : 60
    );
    return () => clearTimeout(timer);
    // steps are rebuilt each render; the step index is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const finish = useCallback(() => {
    setStep(null);
    setRect(null);
    AsyncStorage.setItem(`tour-${id}`, "1").catch(() => {});
  }, [id]);

  return {
    ref: (name: string) => (v: View | null) => {
      refs.current.set(name, v);
    },
    step,
    rect,
    steps,
    start: () => {
      setRect(null);
      setStep(0);
    },
    next: () => {
      haptic.tap();
      setRect(null);
      if (step === null || step + 1 >= steps.length) finish();
      else setStep(step + 1);
    },
    skip: finish,
  };
}

type Tour = ReturnType<typeof useTour>;

const PAD = 6;

/** The dimmed screen with a lit hole over the step's target and the note next to it. Put it last in the screen's root view. */
export function TourOverlay({ tour }: { tour: Tour }) {
  const { t } = useI18n();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // targets are measured in window coordinates; this overlay may start lower (under a header)
  const root = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const measure = () => root.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  if (tour.step === null) return null;
  const s = tour.steps[tour.step];
  const r = tour.rect ? { ...tour.rect, x: tour.rect.x - origin.x, y: tour.rect.y - origin.y } : null;
  const last = tour.step + 1 >= tour.steps.length;
  const hole = r ? { x: Math.max(0, r.x - PAD), y: Math.max(0, r.y - PAD), w: Math.min(width, r.w + PAD * 2), h: r.h + PAD * 2 } : null;
  // the note goes below the hole if there's room, else above it
  const below = !hole || hole.y + hole.h + 190 < height - insets.bottom;
  const noteTop = hole ? (below ? hole.y + hole.h + 12 : undefined) : height * 0.35;
  const noteBottom = hole && !below ? height - hole.y + 12 : undefined;
  const dim = "rgba(6,20,12,0.72)";

  return (
    <View ref={root} onLayout={measure} style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {hole ? (
        <>
          <View style={[styles.dim, { backgroundColor: dim, left: 0, right: 0, top: 0, height: hole.y }]} />
          <View style={[styles.dim, { backgroundColor: dim, left: 0, right: 0, top: hole.y + hole.h, bottom: 0 }]} />
          <View style={[styles.dim, { backgroundColor: dim, left: 0, width: hole.x, top: hole.y, height: hole.h }]} />
          <View style={[styles.dim, { backgroundColor: dim, left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h }]} />
          <Animated.View key={tour.step} entering={FadeIn.duration(200)} style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]} pointerEvents="none" />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dim }]} />
      )}
      <Animated.View key={`n${tour.step}`} entering={FadeInDown.duration(220)} style={[styles.note, { top: noteTop, bottom: noteBottom }]}>
        <Text style={styles.count}>
          {tour.step + 1}/{tour.steps.length}
        </Text>
        <Text style={styles.title}>{s.title}</Text>
        <Text style={T.body}>{s.body}</Text>
        <View style={styles.buttons}>
          {!last && (
            <Tap onPress={tour.skip} style={styles.skip} accessibilityLabel={t("tourSkip")}>
              <Text style={styles.skipText}>{t("tourSkip")}</Text>
            </Tap>
          )}
          <Tap onPress={tour.next} style={styles.next} accessibilityLabel={t(last ? "tourDone" : "tourNext")}>
            <Text style={styles.nextText}>{t(last ? "tourDone" : "tourNext")}</Text>
          </Tap>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute" },
  ring: { position: "absolute", borderRadius: 14, borderWidth: 3, borderColor: "#FACC15" },
  note: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  count: { fontSize: 12, fontWeight: "800", color: C.text3 },
  title: { fontFamily: F.display, fontSize: 21, color: C.text },
  buttons: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 },
  skip: { paddingHorizontal: 12, paddingVertical: 9 },
  skipText: { fontWeight: "700", color: C.text3, fontSize: 15 },
  next: { backgroundColor: C.green, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  nextText: { fontFamily: F.display, fontSize: 17, color: "white" },
});
