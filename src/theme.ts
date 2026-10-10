// アプリ全体の見た目の基準値。
// 高齢の親が使う画面なので「大きく・高コントラスト・少ない要素」を原則にする。

import type { TextStyle, ViewStyle } from "react-native";
import type { Verdict } from "./types";

export const colors = {
  bg: "#F5F6F8",
  surface: "#FFFFFF",
  text: "#1A1A1A",
  subtext: "#5C6169",
  primary: "#2E6BE6",
  primaryText: "#FFFFFF",
  onColor: "#FFFFFF", // 判定の色など、色地の上に置く文字
  danger: "#CE2B1E", // 詐欺かも（赤）。淡い赤（dangerSoft）の地の上でも 4.6:1 以上
  dangerSoft: "#FDECEA", // 淡い赤。バッジの地
  safe: "#117B58", // 大丈夫（緑）。淡い緑（safeSoft）の地の上でも 4.6:1 以上
  safeSoft: "#E7F4EF", // 淡い緑。バッジの地
  unsure: "#B25E00", // 確認中・注意（黄）
  border: "#838CA2", // カード型ボタン・入力欄の枠線。背景に対して 3.1:1 以上
};

// 判定（verdict）ごとの色。返信の色分けに使う。
export const verdictColor: Record<Verdict, string> = {
  danger: colors.danger,
  safe: colors.safe,
  unsure: colors.unsure,
};

// 判定の色を使うスタイル（見出しの文字色・カードの枠色）を 1 回で引く。
export function verdictStyle(verdict: Verdict): {
  text: { color: string };
  border: { borderColor: string };
} {
  const color = verdictColor[verdict];
  return { text: { color }, border: { borderColor: color } };
}

// 高齢者向けに全体的に大きめのフォント。
export const font = {
  hero: 64, // 大ボタンの絵文字
  huge: 40,
  title: 30,
  big: 24,
  body: 20,
  small: 16,
};

// 文字の大きさ（font）ごとの行の高さ。複数行になる文章に付ける。
export const lineHeight = {
  title: 42,
  big: 34,
  body: 30,
  small: 24,
};

// 文字の組（大きさ・太さ・色）。画面の StyleSheet は展開して、余白などの差分だけ書く。
export const textStyle = {
  // 補足（時刻・注記・ラベル）
  caption: { fontSize: font.small, color: colors.subtext },
  // 本文
  body: { fontSize: font.body, color: colors.text },
  // 本文（補助色）
  bodySub: { fontSize: font.body, color: colors.subtext },
  // 本文の太字（小見出し）
  bodyStrong: { fontSize: font.body, fontWeight: "700", color: colors.text },
  // 大きい文字の太字（見出し・返信の文面）
  bigStrong: { fontSize: font.big, fontWeight: "700", color: colors.text },
} satisfies Record<string, TextStyle>;

// 横に並べて、縦は中央にそろえる（絵文字 + 文字の行など）。
export const layout = {
  centerRow: { flexDirection: "row", alignItems: "center" },
} satisfies Record<string, ViewStyle>;

// 押している間の不透明度。ボタン（BigButton）と、行・大ボタン・選択肢で別の値のまま。
export const pressedOpacity = { button: 0.85, item: 0.9 };

export const space = {
  hair: 2,
  tiny: 4,
  xs: 6,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 40,
};

export const radius = { md: 16, lg: 24, pill: 999 };

// 画面ごとに決め打ちしていた寸法。
export const size = { bigButton: 260 }; // 親ホームの丸い大ボタンの直径
