// アプリ全体の見た目の基準値。
// 高齢の親が使う画面なので「大きく・高コントラスト・少ない要素」を原則にする。

import type { TextStyle } from "react-native";
import type { Verdict } from "./types";

// 色の役割。クリームの地・こげ茶の文字・やわらかい橙の主ボタン。緑は子の側と「大丈夫」。
// 判定の 3 色は意味を保つ（赤 = 詐欺かも / 黄 = いったん待って / 緑 = 大丈夫）。
// 組み合わせの基準（本文 4.5:1・大きな文字 3:1・枠と絵の線 3:1）は tests/theme.test.mjs が全組を検査する。
export const colors = {
  bg: "#FBF4E8", // 画面の地（クリーム）
  surface: "#FFFCF6", // カード・数字キー・入力欄の地
  text: "#3B2A1F", // 本文・見出し・絵の線（こげ茶）
  subtext: "#6E5646", // 注記・時刻・入力欄の例文
  primary: "#F2A055", // 主ボタンの地（やわらかい橙）。背景との差が小さいので primaryEdge の縁を付ける
  primaryEdge: "#A9561F", // 主ボタンの縁と影。地（bg）との境目を 3:1 以上にする
  primaryText: "#3B2A1F", // 主ボタンの上の文字（本文と同じこげ茶）
  onColor: "#FFFFFF", // 判定の色地（赤・黄・緑）の上の文字。主ボタンの上には使わない
  link: "#A3461A", // 「つなぎ直す」などのリンク
  linkHover: "#7E3412", // リンクを押している間
  danger: "#B42A1E", // 詐欺かも（赤）。危険の判定・未対応・エラー文
  dangerSoft: "#FCE9E3", // 赤の淡色。結果カード・未対応バッジの地
  unsure: "#8F5600", // まだ分からない（黄）。いったん待っての判定
  unsureSoft: "#FCEFD6", // 黄の淡色。結果カードの地
  safe: "#2D7240", // 大丈夫（緑）。安全の判定・返信済み
  safeSoft: "#E5F1E2", // 緑の淡色。結果カード・返信済みバッジの地
  orangeSoft: "#FBE0C8", // 親の側の絵の丸い台
  greenSoft: "#DCEBD3", // 子の側の絵の丸い台
  border: "#988170", // カード・数字キー・番号の枠・入力欄の枠
  // ここから下は飾り（上に文字を載せない）。
  shade: "#E6D8C6", // カード・キーの下の影
  dangerShade: "#7E1D15", // 赤のボタンの下の影
  unsureShade: "#613A00", // 黄のボタンの下の影
  safeShade: "#1E4F2C", // 緑のボタンの下の影
  artHair: "#D8CFC3", // 絵: 親の白髪
  artGreen: "#8CC084", // 絵: 子の服
  artHeart: "#E07A3A", // 絵: 盾の中のハート
};

// 判定（verdict）ごとの色。返信の色分けに使う。
export const verdictColor: Record<Verdict, string> = {
  danger: colors.danger,
  safe: colors.safe,
  unsure: colors.unsure,
};

// 判定ごとの淡色（結果カードの地）。
export const verdictSoft: Record<Verdict, string> = {
  danger: colors.dangerSoft,
  safe: colors.safeSoft,
  unsure: colors.unsureSoft,
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
  hero: 64, // 子の画面に出す番号
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

// スタイルの表を、型を狭いまま（"700" や string のまま）RN のスタイルとして検査して返す。
function defineStyles<T extends Record<string, TextStyle>>(styles: T): T {
  return styles;
}

// 文字の組（大きさ・太さ・色）。画面の StyleSheet は展開して、余白などの差分だけ書く。
export const textStyle = defineStyles({
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
});

// 画面の上のヘッダー帯（画面の組の見た目。App.tsx の screenOptions が全画面に当てる）。
// 地は画面と同じクリームで境目の線なし、題と戻るの矢印はこげ茶。
export const headerLook = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontSize: font.body,
    fontWeight: "700" as const,
    color: colors.text,
  },
};

// 横に並べて、縦は中央にそろえる（絵文字 + 文字の行など）。
export const layout = defineStyles({
  centerRow: { flexDirection: "row", alignItems: "center" },
});

// 押せる面の色の組（地・文字・縁・下の影）。ボタンや行はここから引く（色の組はここ 1 か所）。
//   primary … 主ボタン（橙の地・こげ茶の文字・濃い橙の縁）/ card … 白いカード（枠線つき）/
//   danger・unsure・safe … 判定の色地（白い文字。縁は地と同じ色で、見た目は縁なし）
export const tone = {
  primary: {
    bg: colors.primary,
    fg: colors.primaryText,
    edge: colors.primaryEdge,
    shade: colors.primaryEdge,
  },
  card: {
    bg: colors.surface,
    fg: colors.text,
    edge: colors.border,
    shade: colors.shade,
  },
  danger: {
    bg: colors.danger,
    fg: colors.onColor,
    edge: colors.danger,
    shade: colors.dangerShade,
  },
  unsure: {
    bg: colors.unsure,
    fg: colors.onColor,
    edge: colors.unsure,
    shade: colors.unsureShade,
  },
  safe: {
    bg: colors.safe,
    fg: colors.onColor,
    edge: colors.safe,
    shade: colors.safeShade,
  },
} satisfies Record<
  string,
  { bg: string; fg: string; edge: string; shade: string }
>;
export type Tone = keyof typeof tone;

// 押している間の不透明度。ボタン（BigButton）と、行・大ボタン・選択肢で別の値のまま。
export const pressedOpacity = { button: 0.85, item: 0.9 };

export const space = {
  hair: 2,
  tiny: 4,
  xs: 6,
  s: 8,
  sm: 12,
  ms: 16,
  md: 20,
  ml: 24,
  lg: 28,
  xl: 40,
};

// 角丸。部品の役割ごとの値（小さい部品ほど小さく）。
export const radius = {
  slot: 18, // 番号の 1 桁の枠
  choice: 20, // 判定の選択肢
  field: 24, // 入力欄
  key: 26, // 数字キー・受信一覧の行
  card: 28, // カード型のボタン（種類・相談の入口）・定型文ボタン
  button: 32, // 主ボタン・役割のボタン・番号の箱・結果カード
  pill: 999,
};

// 押せる面の下に敷く影（ぼかさない色の帯）の厚み。
export const lift = { sm: 4, md: 5, lg: 8 };

// 下に lift の厚みで色の帯を敷く影（ぼかさない）。iOS・Android・Web とも boxShadow で描く。
export function liftShadow(
  offset: number,
  color: string,
): { boxShadow: string } {
  return { boxShadow: `0px ${offset}px 0px ${color}` };
}

// 枠線の太さ。
export const borderWidth = { normal: 2, strong: 3 };

// 画面ごとに決め打ちしていた寸法。
export const size = {
  bigButton: 260, // 親ホームの丸い大ボタンの直径
  bigButtonHalo: 304, // 大ボタンのまわりの淡い輪の直径
  content: 560, // 横に広い画面で、中身を並べる列の最大幅
  minTouch: 48, // 押せる部品の高さの下限
};
