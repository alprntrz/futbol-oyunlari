import { StyleSheet, Text as RNText, useWindowDimensions, type TextProps } from "react-native";

import { onDark, useNight } from "~/lib/surface";

/**
 * Text that follows the iOS/Android text-size setting, with a cap that shrinks
 * as the base size grows: body copy may grow 1.6×, headings 1.3×, display
 * numbers and titles 1.15× (otherwise a 40pt condensed title breaks mid-word at
 * the largest accessibility sizes). Pass maxFontSizeMultiplier to override,
 * or allowFontScaling={false} for text sized to fit a fixed box.
 *
 * On night screens (see lib/surface) dark ink is swapped for light.
 *
 * Scaling is applied here (fontSize and lineHeight × capped factor, native
 * scaling off): RN's own maxFontSizeMultiplier capped the glyphs but still laid
 * the text out at the uncapped size, leaving huge gaps.
 */
export function Text({ allowFontScaling, maxFontSizeMultiplier, style, ...props }: TextProps) {
  const { fontScale } = useWindowDimensions();
  const night = useNight();
  const flat = StyleSheet.flatten(style) ?? {};
  const size = flat.fontSize ?? 14;
  const cap = maxFontSizeMultiplier ?? (size >= 28 ? 1.15 : size >= 20 ? 1.3 : 1.6);
  const k = allowFontScaling === false ? 1 : Math.min(fontScale, cap);
  const scaled = k === 1 ? null : { fontSize: size * k, ...(flat.lineHeight ? { lineHeight: flat.lineHeight * k } : null) };
  // on a night screen, dark ink turns light (cards and buttons opt back out with <Light>)
  const ink = night ? { color: onDark(flat.color as string | undefined) } : null;
  return <RNText {...props} allowFontScaling={false} style={[style, scaled, ink]} />;
}
