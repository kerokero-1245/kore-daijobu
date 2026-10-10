// 二重押しの抑止（createOnce）を固定するテスト。
// 守るもの: 続けて押されても 1 回だけ実行する（相談を 2 件作らない・画面を 2 枚積まない・返信で goBack を 2 回走らせない）こと、
// reset すると（画面に戻ってきたとき）もう一度実行できること。
import assert from "node:assert/strict";
import { test } from "node:test";

import { createOnce } from "../src/domain/once.ts";

test("続けて何回呼んでも、最初の 1 回だけ実行する", () => {
  const once = createOnce();
  let count = 0;
  for (let i = 0; i < 5; i++) once.run(() => count++);
  assert.equal(count, 1);
});

test("2 回目以降に渡した関数は実行しない（最初に渡した関数だけ実行する）", () => {
  const once = createOnce();
  const calls = [];
  once.run(() => calls.push("first"));
  once.run(() => calls.push("second"));
  assert.deepEqual(calls, ["first"]);
});

test("reset すると、もう一度 1 回だけ実行できる", () => {
  const once = createOnce();
  let count = 0;
  once.run(() => count++);
  once.run(() => count++);
  once.reset();
  once.run(() => count++);
  once.run(() => count++);
  assert.equal(count, 2);
});

test("実行していない状態で reset しても、普通に 1 回実行できる", () => {
  const once = createOnce();
  let count = 0;
  once.reset();
  once.run(() => count++);
  assert.equal(count, 1);
});

test("入れ物ごとに独立している（画面ごとに別の抑止）", () => {
  const a = createOnce();
  const b = createOnce();
  let count = 0;
  a.run(() => count++);
  b.run(() => count++);
  assert.equal(count, 2);
});

test("関数を実行している途中（再入）でも、同じ入れ物の 2 回目は実行しない", () => {
  const once = createOnce();
  let count = 0;
  once.run(() => {
    count++;
    once.run(() => count++);
  });
  assert.equal(count, 1);
});

test("run は分割代入して渡しても動く（フックは once.run をそのまま返す）", () => {
  const { run } = createOnce();
  let count = 0;
  run(() => count++);
  run(() => count++);
  assert.equal(count, 1);
});
