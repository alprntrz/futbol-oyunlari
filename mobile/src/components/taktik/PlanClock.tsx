import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { TAKTIK } from "~/lib/brand";
import { C, F } from "~/lib/theme";

import { Text } from "../Text";

/**
 * The set-up clock before kick-off: counts down while `running`, ticks in the
 * last five seconds and kicks off by itself at zero. Mount it with a key per
 * round so every round starts from full time.
 */
export function PlanClock({ seconds, running, onEnd, compact, wide }: { seconds: number; running: boolean; onEnd: () => void; compact?: boolean; wide?: boolean }) {
  const { t } = useI18n();
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (!running || left <= 0) return;
    const id = setTimeout(() => {
      const next = left - 1;
      setLeft(next);
      if (next > 0 && next <= 5) haptic.tap();
      if (next === 0) onEnd();
    }, 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, left]);

  const hurry = left <= 5;
  // a full-width row: a big count and a thick bar (the set-up screen)
  if (wide)
    return (
      <View style={styles.wide} accessibilityLabel={t("ttkPlanLeft").replace("{s}", String(left))}>
        <Image source={TAKTIK.ui.stopwatch} style={{ width: 28, height: 31 }} />
        <Text allowFontScaling={false} style={[styles.wideText, hurry && { color: C.red }]}>
          {left}
          <Text style={styles.wideUnit}> {t("ttkSec")}</Text>
        </Text>
        <View style={styles.wideTrack}>
          <View style={[styles.wideFill, { width: `${(left / seconds) * 100}%` }, hurry && { backgroundColor: C.red }]} />
        </View>
      </View>
    );
  if (compact)
    return (
      <View style={styles.compact} accessibilityLabel={t("ttkPlanLeft").replace("{s}", String(left))}>
        <Image source={TAKTIK.ui.stopwatch} style={{ width: 20, height: 22 }} />
        <View style={{ gap: 3 }}>
          <Text allowFontScaling={false} style={[styles.compactText, hurry && { color: C.red }]}>
            {left} {t("ttkSec")}
          </Text>
          <View style={styles.compactTrack}>
            <View style={[styles.compactFill, { width: `${(left / seconds) * 100}%` }, hurry && { backgroundColor: C.red }]} />
          </View>
        </View>
      </View>
    );
  return (
    <View style={styles.wrap} accessibilityLabel={t("ttkPlanLeft").replace("{s}", String(left))}>
      <View style={styles.row}>
        <Image source={TAKTIK.ui.stopwatch} style={{ width: 16, height: 18 }} />
        <Text allowFontScaling={false} style={[styles.text, hurry && { color: C.red }]}>
          {hurry ? t("ttkPlanHurry") : t("ttkPlanLeft").replace("{s}", String(left))}
        </Text>
        {hurry && <Text style={[styles.text, { color: C.red }]}>{left}</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(left / seconds) * 100}%` }, hurry && { backgroundColor: C.red }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { flexDirection: "row", alignItems: "center", gap: 10 },
  wideText: { fontFamily: F.black, fontSize: 32, lineHeight: 34, color: C.text, minWidth: 74, fontVariant: ["tabular-nums"] },
  wideUnit: { fontFamily: F.display, fontSize: 18, color: C.text2 },
  wideTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: C.key, overflow: "hidden" },
  wideFill: { height: 10, borderRadius: 5, backgroundColor: C.green },
  compact: { flexDirection: "row", alignItems: "center", gap: 7 },
  compactText: { fontFamily: F.display, fontSize: 20, lineHeight: 21, color: C.text },
  compactTrack: { width: 72, height: 4, borderRadius: 2, backgroundColor: C.key, overflow: "hidden" },
  compactFill: { height: 4, borderRadius: 2, backgroundColor: "#F43F5E" },
  wrap: { marginTop: 8, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontFamily: F.display, fontSize: 15, color: C.text2 },
  track: { height: 12, borderRadius: 6, backgroundColor: C.key, overflow: "hidden" },
  fill: { height: 12, borderRadius: 6, backgroundColor: C.green },
});
