import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Mask, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

// Simplified flat flags drawn on a 30×20 canvas (3:2), clipped to rounded
// corners with a hairline edge. Emblems are reduced to simple shapes so the
// flags read at 20-40pt and sit next to the club crests as one icon family.
const W = 30;
const H = 20;

const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
  }).join(" ");

const hStripes = (colors: string[], weights?: number[]) => {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let y = 0;
  return colors.map((c, i) => {
    const h = (w[i] / total) * H;
    const el = <Rect key={i} x={0} y={y} width={W} height={h + 0.05} fill={c} />;
    y += h;
    return el;
  });
};

const vStripes = (colors: string[], weights?: number[]) => {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let x = 0;
  return colors.map((c, i) => {
    const ww = (w[i] / total) * W;
    const el = <Rect key={i} x={x} y={0} width={ww + 0.05} height={H} fill={c} />;
    x += ww;
    return el;
  });
};

const nordic = (bg: string, cross: string, inner?: string) => (
  <>
    <Rect width={W} height={H} fill={bg} />
    <Rect x={8} y={0} width={inner ? 5 : 4} height={H} fill={cross} />
    <Rect x={0} y={inner ? 7.5 : 8} width={W} height={inner ? 5 : 4} fill={cross} />
    {inner && (
      <>
        <Rect x={9.25} y={0} width={2.5} height={H} fill={inner} />
        <Rect x={0} y={8.75} width={W} height={2.5} fill={inner} />
      </>
    )}
  </>
);

const FLAGS: Record<string, React.ReactNode> = {
  brazil: (
    <>
      <Rect width={W} height={H} fill="#1E9E4A" />
      <Polygon points="15,2.5 27,10 15,17.5 3,10" fill="#FEDD00" />
      <Circle cx={15} cy={10} r={4.6} fill="#1B3A8A" />
    </>
  ),
  argentina: (
    <>
      {hStripes(["#74ACDF", "#FFFFFF", "#74ACDF"])}
      <Circle cx={15} cy={10} r={2.2} fill="#F6B40E" />
    </>
  ),
  france: vStripes(["#1F3F99", "#FFFFFF", "#E1242E"]),
  spain: hStripes(["#C60B1E", "#FFC400", "#C60B1E"], [1, 2, 1]),
  germany: hStripes(["#1A1A1A", "#DD0000", "#FFCE00"]),
  italy: vStripes(["#009246", "#FFFFFF", "#CE2B37"]),
  netherlands: hStripes(["#AE1C28", "#FFFFFF", "#21468B"]),
  england: (
    <>
      <Rect width={W} height={H} fill="#FFFFFF" />
      <Rect x={13} y={0} width={4} height={H} fill="#CE1124" />
      <Rect x={0} y={8} width={W} height={4} fill="#CE1124" />
    </>
  ),
  portugal: (
    <>
      {vStripes(["#046A38", "#DA291C"], [2, 3])}
      <Circle cx={12} cy={10} r={3.6} fill="#FFE000" />
      <Circle cx={12} cy={10} r={2.2} fill="#DA291C" />
    </>
  ),
  belgium: vStripes(["#1A1A1A", "#FDDA24", "#EF3340"]),
  croatia: (
    <>
      {hStripes(["#FF0000", "#FFFFFF", "#171796"])}
      <Rect x={11.6} y={5.1} width={6.8} height={8.8} rx={1.8} fill="#FFFFFF" stroke="#171796" strokeWidth={0.7} />
      <Rect x={12} y={5.5} width={3} height={2.67} fill="#FF0000" />
      <Rect x={15} y={8.17} width={3} height={2.67} fill="#FF0000" />
      <Rect x={12} y={10.84} width={3} height={2.67} fill="#FF0000" />
    </>
  ),
  uruguay: (
    <>
      {hStripes(["#FFFFFF", "#0038A8", "#FFFFFF", "#0038A8", "#FFFFFF", "#0038A8", "#FFFFFF", "#0038A8", "#FFFFFF"])}
      <Rect width={12} height={11.1} fill="#FFFFFF" />
      <Circle cx={6} cy={5.5} r={3} fill="#FCD116" />
    </>
  ),
  turkey: (
    <>
      <Rect width={W} height={H} fill="#E30A17" />
      <Circle cx={12} cy={10} r={5} fill="#FFFFFF" />
      <Circle cx={13.3} cy={10} r={4} fill="#E30A17" />
      <Polygon points={star(19.2, 10, 2.6)} fill="#FFFFFF" />
    </>
  ),
  morocco: (
    <>
      <Rect width={W} height={H} fill="#C1272D" />
      <Polygon points={star(15, 10.4, 5)} fill="none" stroke="#006233" strokeWidth={1.1} strokeLinejoin="round" />
    </>
  ),
  serbia: hStripes(["#C6363C", "#0C4076", "#FFFFFF"]),
  senegal: (
    <>
      {vStripes(["#00853F", "#FDEF42", "#E31B23"])}
      <Polygon points={star(15, 10.3, 3)} fill="#00853F" />
    </>
  ),
  colombia: hStripes(["#FCD116", "#003893", "#CE1126"], [2, 1, 1]),
  denmark: nordic("#C8102E", "#FFFFFF"),
  ivorycoast: vStripes(["#F77F00", "#FFFFFF", "#009E60"]),
  nigeria: vStripes(["#008751", "#FFFFFF", "#008751"]),
  usa: (
    <>
      {hStripes(["#B22234", "#FFFFFF", "#B22234", "#FFFFFF", "#B22234", "#FFFFFF", "#B22234"])}
      <Rect width={13} height={11.43} fill="#3C3B6E" />
    </>
  ),
  switzerland: (
    <>
      <Rect width={W} height={H} fill="#DA291C" />
      <Rect x={13.4} y={4} width={3.2} height={12} fill="#FFFFFF" />
      <Rect x={9} y={8.4} width={12} height={3.2} fill="#FFFFFF" />
    </>
  ),
  sweden: nordic("#006AA7", "#FECC00"),
  ghana: (
    <>
      {hStripes(["#CE1126", "#FCD116", "#006B3F"])}
      <Polygon points={star(15, 10.3, 3)} fill="#1A1A1A" />
    </>
  ),
  austria: hStripes(["#ED2939", "#FFFFFF", "#ED2939"]),
  poland: hStripes(["#FFFFFF", "#DC143C"]),
  cameroon: (
    <>
      {vStripes(["#007A5E", "#CE1126", "#FCD116"])}
      <Polygon points={star(15, 10.3, 3)} fill="#FCD116" />
    </>
  ),
  greece: (
    <>
      {hStripes(["#0D5EAF", "#FFFFFF", "#0D5EAF", "#FFFFFF", "#0D5EAF", "#FFFFFF", "#0D5EAF", "#FFFFFF", "#0D5EAF"])}
      <Rect width={11.1} height={11.1} fill="#0D5EAF" />
      <Rect x={4.45} y={0} width={2.2} height={11.1} fill="#FFFFFF" />
      <Rect x={0} y={4.45} width={11.1} height={2.2} fill="#FFFFFF" />
    </>
  ),
  norway: nordic("#BA0C2F", "#FFFFFF", "#00205B"),
  mexico: (
    <>
      {vStripes(["#006847", "#FFFFFF", "#CE1126"])}
      <Circle cx={15} cy={10} r={2.4} fill="#8C5A2B" />
    </>
  ),
  chile: (
    <>
      {hStripes(["#FFFFFF", "#D52B1E"])}
      <Rect width={10} height={10} fill="#0039A6" />
      <Polygon points={star(5, 5.2, 2.6)} fill="#FFFFFF" />
    </>
  ),
  algeria: (
    <>
      {vStripes(["#006233", "#FFFFFF"])}
      {/* crescent: red disc with an offset disc masked out, so both halves show through */}
      <Mask id="dz">
        <Rect width={W} height={H} fill="#000" />
        <Circle cx={14.4} cy={10} r={4.6} fill="#fff" />
        <Circle cx={15.8} cy={10} r={3.8} fill="#000" />
      </Mask>
      <Rect width={W} height={H} fill="#D21034" mask="url(#dz)" />
      <Polygon points={star(17.4, 10, 2)} fill="#D21034" />
    </>
  ),
  wales: (
    <>
      {hStripes(["#FFFFFF", "#00AD36"])}
      <Polygon points="6,14.5 10.5,11 13,12 15.5,7 17.5,10 21,6.5 20.5,10.5 24,10 20,13.5 16,13 13,15.5" fill="#D30731" strokeLinejoin="round" />
    </>
  ),
  scotland: (
    <>
      <Rect width={W} height={H} fill="#005EB8" />
      <Path d="M0 0 L30 20 M30 0 L0 20" stroke="#FFFFFF" strokeWidth={3.4} />
    </>
  ),
};

/** Flat country flag with rounded corners; falls back to a neutral tile. */
export function Flag({ id, width = 36 }: { id: string; width?: number }) {
  const height = (width * H) / W;
  const art = FLAGS[id];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <ClipPath id="flag">
            <Rect width={W} height={H} rx={3.2} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#flag)">
          {art ?? (
            <>
              <Rect width={W} height={H} fill="#DDE3DF" />
              {/* no flag drawn yet: the country's first three letters */}
              <SvgText x={W / 2} y={H / 2 + 3.4} fontSize={9.5} fontWeight="800" fill="#4A5650" textAnchor="middle">
                {id.slice(0, 3).toUpperCase()}
              </SvgText>
            </>
          )}
        </G>
        <Rect x={0.3} y={0.3} width={W - 0.6} height={H - 0.6} rx={3} fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth={0.6} />
      </Svg>
    </View>
  );
}

export const hasFlag = (id: string) => id in FLAGS;
