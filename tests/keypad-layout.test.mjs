// 親の番号入力の寸法（src/domain/keypadLayout.ts）を固定するテスト。
// なぜ: 「つなぐ」を押して送る形にしたあと、低い画面で「つなぐ」が表示域の外に出て、主の流れが止まって見えた。
// 守るもの: よくある低い表示域（スマホのブラウザ 390×664・小さい iPhone の 375×548）で、全体が表示域に収まること。
//   キーの高さは上限と下限の間・広い画面では上限のまま・低いほど詰めた寸法に切り替わること。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPACT,
  KEY_MAX,
  KEY_MIN,
  KEY_MIN_REGULAR,
  REGULAR,
  keypadLayout,
  keypadTotalHeight,
} from "../src/domain/keypadLayout.ts";

// ヘッダー（Web・Android の既定 64）の下の表示域と、説明（2 行 + 2 行）の高さ。
const HEADER = 64;
const DESC = 114;

test("広い画面（390×844）では通常の寸法で、キーは上限の高さ", () => {
  const l = keypadLayout(844 - HEADER, DESC);
  assert.equal(l.keyHeight, KEY_MAX);
  assert.equal(l.buttonHeight, REGULAR.buttonHeight);
});

test("よくある低い表示域（390×664・375×548・515×684）でも全体が表示域に収まる", () => {
  for (const h of [664, 548, 684]) {
    const viewport = h - HEADER;
    const l = keypadLayout(viewport, DESC);
    assert.ok(keypadTotalHeight(l, DESC) <= viewport, `${h}`);
    assert.ok(l.keyHeight >= KEY_MIN, `${h}: キーが低すぎる`);
  }
});

test("通常の寸法でキーが下限より低くなる高さでは、詰めた寸法に切り替わる", () => {
  const l = keypadLayout(548 - HEADER, DESC);
  assert.deepEqual(
    { pad: l.pad, gap: l.gap, slotHeight: l.slotHeight },
    { pad: COMPACT.pad, gap: COMPACT.gap, slotHeight: COMPACT.slotHeight },
  );
  const r = keypadLayout(664 - HEADER, DESC);
  assert.equal(r.pad, REGULAR.pad);
  assert.ok(r.keyHeight >= KEY_MIN_REGULAR);
});

test("キーの高さは、どの高さでも下限と上限の間（200〜1400 を 1 刻みで列挙）", () => {
  let prev = 0;
  for (let h = 200; h <= 1400; h++) {
    const l = keypadLayout(h, DESC);
    assert.ok(l.keyHeight >= KEY_MIN && l.keyHeight <= KEY_MAX, `${h}`);
    assert.ok(Number.isInteger(l.keyHeight), `${h}`);
    if (l.pad === REGULAR.pad) assert.ok(l.keyHeight >= prev, `${h}: 縮んだ`);
    prev = l.pad === REGULAR.pad ? l.keyHeight : prev;
  }
});
