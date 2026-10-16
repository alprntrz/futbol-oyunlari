import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { haptic } from "~/lib/haptics";
import { useI18n } from "~/lib/i18n";
import { F } from "~/lib/theme";

import { Text } from "../Text";
import { Icon } from "../ui";

/**
 * The set-up clock before kick-off: counts down while `running`, ticks in the
 * last five seconds and kicks off by itself at zero. Mount it with a key per
 * round so every round starts from full time.
 */
export function PlanClock({ seconds, running, onEnd }: { seconds: number; running: boolean; onEnd: () => void }) {
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
  return (
    <View style={styles.wrap} accessibilityLabel={t("ttkPlanLeft").replace("{s}", String(left))}>
      <View style={styles.row}>
        <Icon name="stopwatch.fill" size={13} color={hurry ? "#FCA5A5" : "#FDE68A"} fallback="⏱" />
        <Text allowFontScaling={false} style={[styles.text, hurry && { color: "#FCA5A5" }]}>
          {hurry ? t("ttkPlanHurry") : t("ttkPlanLeft").replace("{s}", String(left))}
        </Text>
        {hurry && <Text style={[styles.text, { color: "#FCA5A5" }]}>{left}</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(left / seconds) * 100}%` }, hurry && { backgroundColor: "#F87171" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontFamily: F.display, fontSize: 15, color: "#FDE68A" },
  track: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  fill: { height: 5, borderRadius: 3, backgroundColor: "#FACC15" },
});
