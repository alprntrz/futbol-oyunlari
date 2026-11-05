import { I18nManager, StyleSheet, Text as RNText, useWindowDimensions, type TextProps } from "react-native";

/**
 * Text that follows the iOS/Android text-size setting, with a cap that shrinks
 * as the base size grows: body copy may grow 1.6×, headings 1.3×, display
 * numbers and titles 1.15× (otherwise a 40pt condensed title breaks mid-word at
 * the largest accessibility sizes). Pass maxFontSizeMultiplier to override,
 * or allowFontScaling={false} for text sized to fit a fixed box.
 *
 * Scaling is applied here (fontSize and lineHeight × capped factor, native
 * scaling off): RN's own maxFontSizeMultiplier capped the glyphs but still laid
 * the text out at the uncapped size, leaving huge gaps.
 *
 * Arabic: tracking pulls joined letters apart, and Cairo stands taller than Barlow.
 */
const ARABIC_LINE_HEIGHT = 1.5;

export function Text({ allowFontScaling, maxFontSizeMultiplier, style, ...props }: TextProps) {
  const { fontScale } = useWindowDimensions();
  const flat = StyleSheet.flatten(style) ?? {};
  const size = flat.fontSize ?? 14;
  const cap = maxFontSizeMultiplier ?? (size >= 28 ? 1.15 : size >= 20 ? 1.3 : 1.6);
  const k = allowFontScaling === false ? 1 : Math.min(fontScale, cap);
  const lineHeight = flat.lineHeight && I18nManager.isRTL ? Math.max(flat.lineHeight, size * ARABIC_LINE_HEIGHT) : flat.lineHeight;
  const arabic = I18nManager.isRTL ? { letterSpacing: 0, lineHeight } : null;
  const scaled = k === 1 ? null : { fontSize: size * k, ...(lineHeight ? { lineHeight: lineHeight * k } : null) };
  return <RNText {...props} allowFontScaling={false} style={arabic || scaled ? [style, arabic, scaled] : style} />;
}
