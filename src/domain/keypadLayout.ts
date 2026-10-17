// 親の番号入力の画面で、数字キーの高さと余白を、使える画面の高さから決める純関数。
// なぜ: 6 桁目で自動では送らず「つなぐ」を押して送るので、低い画面（スマホのブラウザの表示域・
//       小さい iPhone）でも「つなぐ」と「消す」がスクロール無しで見えていないと、主の流れが止まって見える。
// まず通常の寸法で入るかを見て、キーが KEY_MIN_REGULAR より低くなるなら、余白とボタンを詰めた寸法に切り替える。
// React・React Native に依存しない（tests/keypad-layout.test.mjs が読む）。

// 数字キーの段の数（1-2-3 / 4-5-6 / 7-8-9 / 空き-0-消す）。
export const KEY_ROWS = 4;
// 数字キーの高さの上限（広い画面でもこれ以上にしない）と下限。
export const KEY_MAX = 72;
export const KEY_MIN_REGULAR = 52;
export const KEY_MIN = 44;

export interface KeypadMetrics {
  pad: number; // 画面の上下の余白
  gap: number; // 説明・番号・キー・「つなぐ」の間
  keyGap: number; // キーどうしの間（縦と横）
  slotHeight: number; // 番号の 1 桁の枠の高さ
  buttonHeight: number; // 「つなぐ」の高さ
}

export const REGULAR: KeypadMetrics = {
  pad: 20,
  gap: 16,
  keyGap: 12,
  slotHeight: 64,
  buttonHeight: 88,
};

export const COMPACT: KeypadMetrics = {
  pad: 8,
  gap: 8,
  keyGap: 8,
  slotHeight: 52,
  buttonHeight: 64,
};

export interface KeypadLayout extends KeypadMetrics {
  keyHeight: number;
}

// 使える高さ（viewport: ヘッダーの下の表示域）と説明の高さ（desc）から、キーに回せる 1 段の高さ。
function fitKey(m: KeypadMetrics, viewport: number, desc: number): number {
  const rest =
    viewport -
    2 * m.pad -
    desc -
    m.slotHeight -
    m.buttonHeight -
    3 * m.gap -
    (KEY_ROWS - 1) * m.keyGap;
  return Math.floor(rest / KEY_ROWS);
}

// 寸法を決める。どちらでも入らない極端に低い画面は、詰めた寸法と KEY_MIN のまま（画面はスクロールできる）。
export function keypadLayout(viewport: number, desc: number): KeypadLayout {
  const regular = fitKey(REGULAR, viewport, desc);
  if (regular >= KEY_MIN_REGULAR)
    return { ...REGULAR, keyHeight: Math.min(regular, KEY_MAX) };
  const compact = fitKey(COMPACT, viewport, desc);
  return {
    ...COMPACT,
    keyHeight: Math.max(KEY_MIN, Math.min(compact, KEY_MAX)),
  };
}

// 並べたときの全体の高さ（テストで「表示域に収まる」を確かめるのに使う）。
export function keypadTotalHeight(l: KeypadLayout, desc: number): number {
  return (
    2 * l.pad +
    desc +
    l.slotHeight +
    l.buttonHeight +
    3 * l.gap +
    KEY_ROWS * l.keyHeight +
    (KEY_ROWS - 1) * l.keyGap
  );
}
