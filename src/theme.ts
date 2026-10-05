// アプリ全体の見た目の基準値。
// 高齢の親が使う画面なので「大きく・高コントラスト・少ない要素」を原則にする。

export const colors = {
  bg: '#F5F6F8',
  surface: '#FFFFFF',
  text: '#1A1A1A',
  subtext: '#5C6169',
  primary: '#2E6BE6',
  primaryText: '#FFFFFF',
  danger: '#CE2B1E', // 詐欺かも（赤）。淡い赤のバッジ上でも 4.6:1 以上
  safe: '#117B58', // 大丈夫（緑）。淡い緑のバッジ上でも 4.6:1 以上
  unsure: '#B25E00', // 確認中・注意（黄）
  border: '#838CA2', // カード型ボタン・入力欄の枠線。背景に対して 3.1:1 以上
};

// 判定（verdict）ごとの色。返信の色分けに使う。
export const verdictColor: Record<'danger' | 'safe' | 'unsure', string> = {
  danger: colors.danger,
  safe: colors.safe,
  unsure: colors.unsure,
};

// 高齢者向けに全体的に大きめのフォント。
export const font = {
  huge: 40,
  title: 30,
  big: 24,
  body: 20,
  small: 16,
};

export const space = { xs: 6, sm: 12, md: 20, lg: 28, xl: 40 };

export const radius = { md: 16, lg: 24 };