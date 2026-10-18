// 重なった読み込みの結果を始めた順で選ぶ createLatest（src/data/latest.ts）を固定するテスト。
// 守るもの:
//   - 後から始めた読み込みの結果が入ったあとは、先に始めた読み込みの結果も失敗も捨てる
//   - 先に始めた読み込みの成功は、後の読み込みがまだでも使う（使わないと、後の読み込みが失敗したとき何も入らない）
//   - 先に始めた読み込みの失敗は、後の読み込みが走っている間は捨てる（後の結果を待つ）
//   - 最後に始めた読み込みの失敗は使う（失敗を画面に出せる）
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { test } from "node:test";

const { createLatest } = await import("../src/data/latest.ts");

test("1 本だけなら、成功も失敗も使う", () => {
  const l = createLatest();
  assert.equal(l.accept(l.begin(), "result"), true);
  assert.equal(l.accept(l.begin(), "failure"), true);
});

test("後から始めた方の結果が先に着いたら、先に始めた方の結果と失敗は捨てる", () => {
  const l = createLatest();
  const a = l.begin();
  const b = l.begin();
  assert.equal(l.accept(b, "result"), true);
  assert.equal(l.accept(a, "result"), false);
  const c = l.begin();
  const d = l.begin();
  assert.equal(l.accept(d, "failure"), true);
  assert.equal(l.accept(c, "failure"), false);
  assert.equal(l.accept(c, "result"), false);
});

test("始めた順に着いたら、どちらの結果も使う", () => {
  const l = createLatest();
  const a = l.begin();
  const b = l.begin();
  assert.equal(l.accept(a, "result"), true);
  assert.equal(l.accept(b, "result"), true);
});

test("後の読み込みが走っている間の、先の読み込みの失敗は捨てる。後の失敗は使う", () => {
  const l = createLatest();
  const a = l.begin();
  const b = l.begin();
  assert.equal(l.accept(a, "failure"), false);
  assert.equal(l.accept(b, "failure"), true);
});

test("同じ番号は 2 度使わない", () => {
  const l = createLatest();
  const a = l.begin();
  assert.equal(l.accept(a, "result"), true);
  assert.equal(l.accept(a, "result"), false);
});
