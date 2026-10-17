// 相談の種類（category）の表示（ラベル・絵の名前・並び）を固定するテスト。
// 守るもの: 親が選ぶ画面（CategorySelect）・親ホーム・受信一覧・相談の詳細が、同じ表から名前と絵を引くこと。
// 種類を足したのに表や並びへの追加を忘れる、表の並びが入れ替わる、といった食い違いをここで止める
// （表は Record なので足し忘れは型でも止まる。並びの配列はここで止める）。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CATEGORIES,
  CATEGORY_META,
  CATEGORY_ORDER,
  categoryIcon,
  categoryLabel,
} from "../src/domain/category.ts";

// 画面に出る値そのもの（親が選ぶ表示順）。
const EXPECTED = [
  ["money", "お金の話", "cat-money"],
  ["refund", "還付金・税金", "cat-refund"],
  ["construction", "点検・工事・リフォーム", "cat-construction"],
  ["impersonation", "家族や役所を名乗る電話", "cat-impersonation"],
  ["other", "その他", "cat-other"],
];

test("表の並び・ラベル・絵の名前が、画面に出ている値と同じ", () => {
  assert.deepEqual(
    CATEGORIES.map((c) => [c.key, c.label, c.icon]),
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

test("categoryLabel / categoryIcon は表の全種類を引ける（表から動的に列挙・0 件なら失敗）", () => {
  assert.ok(CATEGORY_ORDER.length > 0, "並びが空");
  for (const key of CATEGORY_ORDER) {
    const meta = CATEGORY_META[key];
    assert.ok(meta, `種類 ${key} が表に無い`);
    assert.equal(categoryLabel(key), meta.label);
    assert.equal(categoryIcon(key), meta.icon);
    assert.ok(meta.label.length > 0 && meta.icon.length > 0);
  }
});

test("種類ごとに期待どおりのラベルと絵の名前を返す", () => {
  for (const [key, label, icon] of EXPECTED) {
    assert.equal(categoryLabel(key), label);
    assert.equal(categoryIcon(key), icon);
  }
});

// 新しい種類を古いアプリが受けたとき（表に無い値）、画面が落ちずに「その他」の表示になること。
test("知らない種類は other の表示（その他・その他の絵）に寄せる", () => {
  assert.equal(categoryLabel("unknown"), CATEGORY_META.other.label);
  assert.equal(categoryIcon("unknown"), CATEGORY_META.other.icon);
  assert.equal(categoryLabel("unknown"), "その他");
  assert.equal(categoryIcon("unknown"), "cat-other");
});
