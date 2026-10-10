// 相談の種類（category）の表示（ラベル・絵文字・並び）を固定するテスト。
// 守るもの: 親が選ぶ画面（CategorySelect）・親ホーム・受信一覧・相談の詳細が、同じ表から名前と絵文字を引くこと。
// 種類を足したのに表や並びへの追加を忘れる、表の並びが入れ替わる、といった食い違いをここで止める
// （表は Record なので足し忘れは型でも止まる。並びの配列はここで止める）。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATEGORIES,
  CATEGORY_META,
  CATEGORY_ORDER,
  categoryEmoji,
  categoryLabel,
} from "../src/domain/category.ts";

// 画面に出る値そのもの（親が選ぶ表示順）。
const EXPECTED = [
  ["money", "お金の話", "💰"],
  ["refund", "還付金・税金", "🏦"],
  ["construction", "点検・工事・リフォーム", "🔧"],
  ["impersonation", "家族や役所を名乗る電話", "📞"],
  ["other", "その他", "❓"],
];

test("表の並び・ラベル・絵文字が、画面に出ている値と同じ", () => {
  assert.deepEqual(
    CATEGORIES.map((c) => [c.key, c.label, c.emoji]),
    EXPECTED,
  );
});

test("CATEGORY_ORDER は CATEGORY_META の全種類を 1 回ずつ含む（表から動的に列挙・0 件なら失敗）", () => {
  const metaKeys = Object.keys(CATEGORY_META);
  assert.ok(metaKeys.length > 0, "表が空");
  assert.deepEqual([...CATEGORY_ORDER].sort(), [...metaKeys].sort());
  assert.equal(
    new Set(CATEGORY_ORDER).size,
    CATEGORY_ORDER.length,
    "並びに重複",
  );
});

test("categoryLabel / categoryEmoji は表の全種類を引ける（表から動的に列挙・0 件なら失敗）", () => {
  assert.ok(CATEGORY_ORDER.length > 0, "並びが空");
  for (const key of CATEGORY_ORDER) {
    const meta = CATEGORY_META[key];
    assert.ok(meta, `種類 ${key} が表に無い`);
    assert.equal(categoryLabel(key), meta.label);
    assert.equal(categoryEmoji(key), meta.emoji);
    assert.ok(meta.label.length > 0 && meta.emoji.length > 0);
  }
});

test("種類ごとに期待どおりのラベルと絵文字を返す", () => {
  for (const [key, label, emoji] of EXPECTED) {
    assert.equal(categoryLabel(key), label);
    assert.equal(categoryEmoji(key), emoji);
  }
});
