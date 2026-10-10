// theme の基準値の「関係」を固定するテスト（値そのものは、前後の撮影の画素差で守る）。
// 守るもの:
//   - theme.ts のコメントにある色の約束: 淡い地（dangerSoft / safeSoft）の上の danger / safe は 4.6:1 以上、
//     枠線 border は背景に対して 3.1:1 以上（高齢の親が読める濃さ）
//   - 行の高さが文字の大きさより大きいこと、文字の組（textStyle）が font と colors の値だけでできていること
//   - 押している間の不透明度が 0〜1 の間にあること、space が小さい順に並んでいること
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  colors,
  font,
  lineHeight,
  pressedOpacity,
  radius,
  size,
  space,
  textStyle,
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

test("淡い地の上の文字: danger は dangerSoft の上で、safe は safeSoft の上で 4.6:1 以上", () => {
  assert.ok(contrast(colors.danger, colors.dangerSoft) >= 4.6);
  assert.ok(contrast(colors.safe, colors.safeSoft) >= 4.6);
});

test("淡い色（〜Soft）は、対応する色と対で colors にある（colors から動的に列挙・0 件なら失敗）", () => {
  const soft = Object.keys(colors).filter((k) => k.endsWith("Soft"));
  assert.ok(soft.length > 0, "〜Soft の色が 0 件");
  for (const name of soft) {
    assert.ok(colors[name.replace(/Soft$/, "")], `${name} の元の色が無い`);
  }
});

test("枠線 border は背景 bg にも surface にも 3.1:1 以上", () => {
  assert.ok(contrast(colors.border, colors.bg) >= 3.1);
  assert.ok(contrast(colors.border, colors.surface) >= 3.1);
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
