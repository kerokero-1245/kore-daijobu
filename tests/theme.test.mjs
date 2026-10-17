// theme の基準値の「関係」を固定するテスト（値そのものは、前後の撮影の画素差で守る）。
// なぜ: 色を見た目で決めると、補助文や淡い地の上で高齢の親に読めない組が紛れ込む。比は hex から計算して基準と照らす。
// 守るもの:
//   - 画面で使う色の組（文字色・線 / 地色）が基準を満たすこと: 本文 4.5:1・大きな文字（24px 以上の太字）3:1・
//     枠線と絵の線 3:1。組の表は下の PAIRS（デザインの色の表と同じ組）
//   - colors の全色が、組の表か飾り（影・絵の色。上に文字を載せない）のどちらかに入っていること（色を足したら組も足す）
//   - 押せる面の色の組（tone）: 文字は地の上で 4.5:1 以上、縁は画面の地（bg）に対して 3:1 以上。
//     主ボタンの文字は primaryText（こげ茶）で、白い文字（onColor）は判定の色地の上だけに載せる
//   - 行の高さが文字の大きさより大きいこと、文字の組（textStyle）が font と colors の値だけでできていること
//   - 押している間の不透明度が 0〜1 の間にあること、space が小さい順に並んでいること
//   - verdictStyle が、判定の色を文字色と枠色の両方に同じ値で返すこと
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  borderWidth,
  colors,
  font,
  layout,
  lift,
  liftShadow,
  lineHeight,
  pressedOpacity,
  radius,
  size,
  space,
  textStyle,
  tone,
  verdictColor,
  verdictSoft,
  verdictStyle,
} from "../src/theme.ts";

// WCAG のコントラスト比（相対輝度）。
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("colors はすべて #RRGGBB", () => {
  const entries = Object.entries(colors);
  assert.ok(entries.length > 0);
  for (const [name, value] of entries) {
    assert.match(value, /^#[0-9A-F]{6}$/, name);
  }
});

// 基準（種別ごとの最小のコントラスト比）。
const THRESHOLD = { 本文: 4.5, 大文字: 3.0, 枠線: 3.0 };

// 画面で使う色の組 [文字色・線, 地色, 種別, 用途]。
const PAIRS = [
  ["text", "bg", "本文", "本文・見出し"],
  ["text", "surface", "本文", "カードの文字・数字キー"],
  ["subtext", "bg", "本文", "注記・時刻"],
  ["subtext", "surface", "本文", "カードの補助文・入力欄の例文"],
  ["primaryText", "primary", "本文", "主ボタンの文字（補助文 16px を含む）"],
  ["link", "bg", "本文", "つなぎ直す"],
  ["linkHover", "bg", "本文", "つなぎ直す（押している間）"],
  ["onColor", "danger", "本文", "定型文ボタン 詐欺かも・送れなかった知らせ"],
  ["onColor", "unsure", "本文", "定型文ボタン いったん待って"],
  ["onColor", "safe", "本文", "定型文ボタン 大丈夫"],
  ["danger", "surface", "本文", "判定の選択肢 詐欺かも・エラー文"],
  ["danger", "bg", "本文", "エラー文（地は背景）"],
  ["unsure", "surface", "本文", "判定の選択肢 まだ分からない"],
  ["safe", "surface", "本文", "判定の選択肢 大丈夫そう"],
  ["danger", "dangerSoft", "本文", "未対応バッジ・結果カード 詐欺かもの見出し"],
  ["safe", "safeSoft", "本文", "返信済みバッジ・結果カード 大丈夫の見出し"],
  ["unsure", "unsureSoft", "本文", "結果カード 不明の見出し"],
  ["text", "dangerSoft", "本文", "結果カード 詐欺かもの文面"],
  ["subtext", "dangerSoft", "本文", "結果カード 詐欺かもの差出人"],
  ["text", "safeSoft", "本文", "結果カード 大丈夫の文面"],
  ["subtext", "safeSoft", "本文", "結果カード 大丈夫の差出人"],
  ["text", "unsureSoft", "本文", "結果カード 不明の文面"],
  ["subtext", "unsureSoft", "本文", "結果カード 不明の差出人"],
  ["text", "orangeSoft", "本文", "「消す」キーの文字"],
  ["danger", "bg", "大文字", "結果の見出し 詐欺かもしれません"],
  ["safe", "bg", "大文字", "結果の見出し 大丈夫そうです"],
  ["unsure", "bg", "大文字", "結果の見出し いったん待って"],
  ["primaryText", "primary", "大文字", "ホームの大ボタンの文字"],
  ["border", "bg", "枠線", "カード・キーの枠（地は背景）"],
  ["border", "surface", "枠線", "カード・キーの枠（地は面）"],
  ["primaryEdge", "bg", "枠線", "主ボタンの縁"],
  ["primaryEdge", "orangeSoft", "枠線", "相談中の輪"],
  ["danger", "bg", "枠線", "結果カードの枠 詐欺かも"],
  ["safe", "bg", "枠線", "結果カードの枠 大丈夫"],
  ["unsure", "bg", "枠線", "結果カードの枠 不明"],
  ["text", "orangeSoft", "枠線", "絵の線（橙の台）"],
  ["text", "greenSoft", "枠線", "絵の線（緑の台）"],
  ["text", "primary", "枠線", "絵の線（主ボタンの上）"],
  ["onColor", "danger", "枠線", "判定の絵の白い線（赤）"],
  ["onColor", "unsure", "枠線", "判定の絵の白い線（黄）"],
  ["onColor", "safe", "枠線", "判定の絵の白い線（緑）"],
];

// 飾りの色（影・絵の中の色）。上に文字を載せないので、組の表には入れない。
const DECORATIVE = [
  "shade",
  "dangerShade",
  "unsureShade",
  "safeShade",
  "artHair",
  "artGreen",
  "artHeart",
];

test("色の組はどれも基準を満たす（本文 4.5:1・大きな文字 3:1・枠線 3:1。組の表から列挙・0 件なら失敗）", () => {
  assert.ok(PAIRS.length > 0, "組が 0 件");
  const fails = [];
  for (const [fg, bg, kind, use] of PAIRS) {
    assert.ok(colors[fg], `${use}: colors.${fg} が無い`);
    assert.ok(colors[bg], `${use}: colors.${bg} が無い`);
    const need = THRESHOLD[kind];
    assert.ok(need, `${use}: 種別 ${kind} が基準に無い`);
    const got = contrast(colors[fg], colors[bg]);
    if (got < need)
      fails.push(`${use}: ${fg}/${bg} = ${got.toFixed(2)}:1 < ${need}:1`);
  }
  assert.deepEqual(fails, []);
});

test("colors の全色が、組の表か飾りの表のどちらかに入っている（colors から列挙・0 件なら失敗）", () => {
  const names = Object.keys(colors);
  assert.ok(names.length > 0, "colors が空");
  const inPairs = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));
  for (const name of names) {
    assert.ok(
      inPairs.has(name) || DECORATIVE.includes(name),
      `${name} がどちらの表にも無い`,
    );
    assert.ok(
      !(inPairs.has(name) && DECORATIVE.includes(name)),
      `${name} が両方の表にある`,
    );
  }
  for (const name of DECORATIVE) assert.ok(colors[name], `飾り ${name} が無い`);
});

test("押せる面の色の組（tone）: 文字は地の上で 4.5:1 以上、縁は画面の地に対して 3:1 以上（tone から列挙・0 件なら失敗）", () => {
  const tones = Object.entries(tone);
  assert.ok(tones.length > 0, "tone が空");
  for (const [name, t] of tones) {
    for (const key of ["bg", "fg", "edge", "shade"]) {
      assert.ok(Object.values(colors).includes(t[key]), `${name}.${key}`);
    }
    assert.ok(contrast(t.fg, t.bg) >= 4.5, `${name}: 文字と地`);
    assert.ok(contrast(t.edge, colors.bg) >= 3.0, `${name}: 縁と画面の地`);
  }
});

test("主ボタンの文字は primaryText（こげ茶）で、白い文字（onColor）は判定の色地だけに載せる", () => {
  assert.equal(tone.primary.bg, colors.primary);
  assert.equal(tone.primary.fg, colors.primaryText);
  assert.equal(tone.primary.edge, colors.primaryEdge);
  assert.notEqual(colors.primaryText, colors.onColor);
  const verdicts = Object.keys(verdictColor);
  assert.ok(verdicts.length > 0, "verdictColor が空");
  for (const [name, t] of Object.entries(tone)) {
    const isVerdict = verdicts.includes(name);
    assert.equal(t.fg === colors.onColor, isVerdict, `${name}: 白い文字`);
    if (isVerdict) assert.equal(t.bg, verdictColor[name], name);
  }
});

test("判定の淡色（verdictSoft）は、判定の色と同じ判定を全部持ち、判定の色の文字が 4.5:1 以上で読める", () => {
  const verdicts = Object.keys(verdictColor);
  assert.ok(verdicts.length > 0, "verdictColor が空");
  assert.deepEqual(Object.keys(verdictSoft).sort(), [...verdicts].sort());
  for (const v of verdicts) {
    assert.ok(contrast(verdictColor[v], verdictSoft[v]) >= 4.5, v);
    assert.ok(contrast(colors.text, verdictSoft[v]) >= 4.5, v);
  }
});

test("liftShadow は、ぼかさない影を下にだけ敷く（boxShadow の文字列）", () => {
  assert.deepEqual(liftShadow(lift.md, colors.primaryEdge), {
    boxShadow: `0px ${lift.md}px 0px ${colors.primaryEdge}`,
  });
  for (const v of [...Object.values(lift), ...Object.values(borderWidth)])
    assert.ok(Number.isInteger(v) && v > 0);
});

test("lineHeight は font の同じ名前の段にあり、どれも文字の大きさより大きい（動的に列挙・0 件なら失敗）", () => {
  const names = Object.keys(lineHeight);
  assert.ok(names.length > 0, "lineHeight が空");
  for (const name of names) {
    assert.ok(name in font, `font に ${name} が無い`);
    assert.ok(lineHeight[name] > font[name], name);
  }
});

test("textStyle は font と colors の値だけでできている（動的に列挙・0 件なら失敗）", () => {
  const tokens = Object.entries(textStyle);
  assert.ok(tokens.length > 0, "textStyle が空");
  for (const [name, style] of tokens) {
    assert.ok(
      Object.values(font).includes(style.fontSize),
      `${name}: fontSize`,
    );
    assert.ok(Object.values(colors).includes(style.color), `${name}: color`);
    if ("fontWeight" in style) {
      assert.ok(
        ["700", "800"].includes(style.fontWeight),
        `${name}: fontWeight`,
      );
    }
  }
});

test("押している間の不透明度は 0 より大きく 1 より小さい（動的に列挙・0 件なら失敗）", () => {
  const values = Object.values(pressedOpacity);
  assert.ok(values.length > 0);
  for (const v of values) assert.ok(v > 0 && v < 1);
});

test("space は小さい順に並び、radius・size・font はどれも正の数", () => {
  const spaces = Object.values(space);
  assert.ok(spaces.length > 1);
  for (let i = 1; i < spaces.length; i++) assert.ok(spaces[i] > spaces[i - 1]);
  for (const group of [space, radius, size, font]) {
    for (const v of Object.values(group)) assert.ok(v > 0);
  }
});

test("verdictStyle: 判定の色を、文字色（text）と枠色（border）の両方に同じ値で返す（動的に列挙・0 件なら失敗）", () => {
  const verdicts = Object.keys(verdictColor);
  assert.ok(verdicts.length > 0, "verdictColor が空");
  for (const v of verdicts) {
    assert.deepEqual(verdictStyle(v), {
      text: { color: verdictColor[v] },
      border: { borderColor: verdictColor[v] },
    });
  }
});

test("layout.centerRow は 横並び・縦は中央", () => {
  assert.deepEqual(layout.centerRow, {
    flexDirection: "row",
    alignItems: "center",
  });
});
