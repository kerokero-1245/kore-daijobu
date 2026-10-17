// 自作の絵（SVG）。絵文字は OS の絵文字フォントで見た目が変わるので使わず、ここの絵だけを使う。
// 絵はどれも 48×48 の座標で描き、size で大きさだけを変える。線はこげ茶（colors.text）の丸い端。
// 色は theme の colors から引く（hex をここに書かない）。絵は飾りなので、読み上げからは外す
// （意味は隣の文字か、押せる部品の accessibilityLabel が伝える）。

import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { colors } from "../../theme";
import type { IconName } from "../../types";

const c = colors;

// 絵ごとの中身（Svg の子）。Record なので、絵の名前を足したときの描き漏れを型が検出する。
const SHAPES: Record<IconName, React.ReactNode> = {
  parent: (
    <>
      <Path d="M8 44c0-9 7-12 16-12s16 3 16 12" fill={c.primary} />
      <Circle cx="24" cy="21" r="10" fill={c.surface} strokeWidth={3} />
      <Path
        d="M14 20c0-7 4.5-10 10-10s10 3 10 10c-3-3-6.5-4-10-4s-7 1-10 4z"
        fill={c.artHair}
      />
      <Circle cx="24" cy="8" r="4" fill={c.artHair} />
      <Circle cx="20" cy="23" r="2.4" strokeWidth={1.6} />
      <Circle cx="28" cy="23" r="2.4" strokeWidth={1.6} />
      <Path d="M22.4 23h3.2" strokeWidth={1.6} />
      <Path d="M21.8 27.3q2.2 1.4 4.4 0" strokeWidth={2} />
    </>
  ),
  child: (
    <>
      <Path d="M8 44c0-9 7-12 16-12s16 3 16 12" fill={c.artGreen} />
      <Path d="M20 32l4 5 4-5" strokeWidth={2.5} />
      <Circle cx="24" cy="19" r="10" fill={c.surface} strokeWidth={3} />
      <Path
        d="M14.2 16.5c.5-5.5 4.5-8.5 9.8-8.5s9.3 3 9.8 8.5c-2.5-1.8-5.5-2.8-8.3-2.8-1.2 1.5-3.5 2.4-6 2.4-1.9 0-3.6.1-5.3.4z"
        fill={c.text}
      />
      <Circle cx="20" cy="20.5" r="1.5" fill={c.text} stroke="none" />
      <Circle cx="28" cy="20.5" r="1.5" fill={c.text} stroke="none" />
      <Path d="M21.5 24.2q2.5 1.6 5 0" strokeWidth={2} />
    </>
  ),
  shield: (
    <>
      <Path
        d="M24 5l15 5v12c0 10-7 17-15 21C16 39 9 32 9 22V10z"
        fill={c.surface}
      />
      <Path
        d="M24 32c-7-5-9-8-9-11 0-3 2.5-5 5-5 2 0 3.3 1.2 4 2.6.7-1.4 2-2.6 4-2.6 2.5 0 5 2 5 5 0 3-2 6-9 11z"
        fill={c.artHeart}
        strokeWidth={2.5}
      />
    </>
  ),
  "cat-money": (
    <>
      <Circle cx="19.5" cy="11" r="3" fill={c.surface} strokeWidth={2.5} />
      <Circle cx="28.5" cy="11" r="3" fill={c.surface} strokeWidth={2.5} />
      <Path
        d="M8 22c0-6 6-8 16-8s16 2 16 8v12c0 5-4 7-9 7H17c-5 0-9-2-9-7z"
        fill={c.primary}
      />
      <Path d="M8.5 22h31" />
      <Circle cx="24" cy="30" r="4.5" fill={c.surface} strokeWidth={2.5} />
    </>
  ),
  "cat-refund": (
    <>
      <Rect x="9" y="6" width="30" height="37" rx="5" fill={c.surface} />
      <Path
        d="M9 13V11a5 5 0 0 1 5-5h20a5 5 0 0 1 5 5v2z"
        fill={c.primary}
        strokeWidth={3}
      />
      <Path d="M18 18l6 8 6-8M24 26v11M19 28.5h10M19 33h10" />
    </>
  ),
  "cat-construction": (
    <>
      <Path d="M11 22v18h26V22L24 11z" fill={c.surface} />
      <Path d="M6 24L24 8l18 16" />
      <Rect
        x="19.5"
        y="29"
        width="9"
        height="11"
        rx="2"
        fill={c.primary}
        strokeWidth={3}
      />
      <Path d="M34 8.5v7" strokeWidth={5} />
    </>
  ),
  "cat-impersonation": (
    <>
      <Path
        d="M14 9c-3 0-6 3-6 6 0 14 11 25 25 25 3 0 6-3 6-6v-4l-8-3-4 4c-5-2-9-6-11-11l4-4-3-7z"
        fill={c.primary}
      />
      <Path d="M29 6h13v10h-6l-4 3v-3h-3z" fill={c.surface} strokeWidth={3} />
    </>
  ),
  "cat-other": (
    <>
      <Path
        d="M8 12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H22l-8 7v-7h-1a5 5 0 0 1-5-5z"
        fill={c.surface}
      />
      <Path d="M19.5 15.5c0-2.8 2-4.5 4.5-4.5s4.5 1.7 4.5 4.3c0 3.7-4.5 3.7-4.5 7.2" />
      <Circle cx="24" cy="27.5" r="2" fill={c.text} stroke="none" />
    </>
  ),
  erase: (
    <>
      <Path
        d="M18 11h20a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H18L6 24z"
        fill={c.surface}
      />
      <Path d="M24 19l9 10M33 19l-9 10" />
    </>
  ),
  "status-answered": (
    <>
      <Circle cx="24" cy="24" r="17" fill={c.safe} stroke={c.safe} />
      <Path d="M16 24.5l5.5 5.5L32.5 18" stroke={c.onColor} strokeWidth={4} />
    </>
  ),
  "status-waiting": (
    <>
      <Circle cx="24" cy="24" r="17" fill={c.danger} stroke={c.danger} />
      <Path d="M24 15v9.5l6 4" stroke={c.onColor} strokeWidth={4} />
    </>
  ),
  "verdict-danger": (
    <>
      <Path
        d="M24 7l18 32H6z"
        fill={c.danger}
        stroke={c.danger}
        strokeWidth={4}
      />
      <Path d="M24 18v10" stroke={c.onColor} strokeWidth={4} />
      <Circle cx="24" cy="33.5" r="2.3" fill={c.onColor} stroke="none" />
    </>
  ),
  "verdict-safe": (
    <>
      <Circle cx="24" cy="24" r="18" fill={c.safe} stroke={c.safe} />
      <Path d="M15 24.5l6 6L33 18" stroke={c.onColor} strokeWidth={4.5} />
    </>
  ),
  "verdict-unsure": (
    <>
      <Circle cx="24" cy="24" r="18" fill={c.unsure} stroke={c.unsure} />
      <Path
        d="M19.5 16.5v15M28.5 16.5v15"
        stroke={c.onColor}
        strokeWidth={4.5}
      />
    </>
  ),
  "entry-unseen": (
    <>
      <Rect x="6" y="13" width="34" height="25" rx="4" fill={c.surface} />
      <Path d="M8 16l15 11 15-11" />
      <Circle cx="39" cy="12" r="5" fill={c.primary} strokeWidth={3} />
    </>
  ),
  "entry-waiting": (
    <>
      <Path d="M15 7h18M15 41h18" />
      <Path
        d="M17 7c0 9 7 12 7 17s-7 8-7 17h14c0-9-7-12-7-17s7-8 7-17z"
        fill={c.surface}
      />
      <Path d="M20 38h8l-4-5z" fill={c.primary} strokeWidth={2.5} />
    </>
  ),
  "entry-seen": (
    <>
      <Circle cx="24" cy="24" r="17" fill={c.surface} />
      <Path d="M16 24.5l5.5 5.5L32.5 18" />
    </>
  ),
  "arrow-back": <Path d="M27 12L15 24l12 12M16 24h18" strokeWidth={4} />,
  connect: (
    <>
      <Path d="M20 28l8-8" />
      <Path d="M22 14l3-3a8 8 0 0 1 12 12l-3 3" />
      <Path d="M26 34l-3 3a8 8 0 0 1-12-12l3-3" />
    </>
  ),
  timer: (
    <>
      <Circle cx="24" cy="26" r="15" stroke={c.subtext} strokeWidth={4} />
      <Path d="M24 18v8l5 4M19 6h10" stroke={c.subtext} strokeWidth={4} />
    </>
  ),
};

interface Props {
  name: IconName;
  size: number;
}

export default function Icon({ name, size }: Props) {
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        fill="none"
        stroke={c.text}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {SHAPES[name]}
      </Svg>
    </View>
  );
}
