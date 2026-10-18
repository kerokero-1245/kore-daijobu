// 子の待ち画面の読み直し startWaitWatch（src/data/waitWatch.ts）と、その間隔 waitPollDelay（src/domain/pairing.ts）を固定するテスト。
// 守るもの:
//   - 始めると、ペアの変化の購読・前面復帰・一定間隔の 3 つをまとめて始める（どれが来ても読み直す）
//   - 止めると、3 つをまとめて止める（待ち画面を離れたあとに読み直さない）
//   - 間隔は番号の期限までは 5 秒、期限を過ぎたら 60 秒（期限切れの番号では、つながらないので回数を減らす）
// 時計は node:test の mock.timers（setInterval と setTimeout の両方）で進める。止める関数は afterEach で必ず呼ぶ。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

const { startWaitWatch } = await import("../src/data/waitWatch.ts");
const { waitPollDelay, WAIT_POLL_MS, WAIT_POLL_SLOW_MS } =
  await import("../src/domain/pairing.ts");

// 購読と前面復帰の偽物。今つながっている数と、知らせを送る口を持つ。
function fakeSource() {
  const listeners = new Set();
  return {
    listen(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    fire: () => listeners.forEach((fn) => fn()),
    get count() {
      return listeners.size;
    },
  };
}

describe("startWaitWatch", () => {
  let stops = [];
  let checks = 0;
  let sub;
  let fg;
  const start = (delay = () => 5000) => {
    const stop = startWaitWatch({
      subscribe: sub.listen,
      onForeground: fg.listen,
      check: () => checks++,
      delay,
    });
    stops.push(stop);
    return stop;
  };
  beforeEach(() => {
    mock.timers.enable({ apis: ["setInterval", "setTimeout"] });
    checks = 0;
    sub = fakeSource();
    fg = fakeSource();
  });
  afterEach(() => {
    for (const stop of stops) stop();
    stops = [];
    mock.timers.reset();
  });

  test("始めると購読と前面復帰をつなぎ、始めた時点では読み直さない", () => {
    start();
    assert.equal(sub.count, 1);
    assert.equal(fg.count, 1);
    assert.equal(checks, 0);
  });

  test("購読の知らせ・前面復帰・一定間隔のどれでも読み直す", () => {
    start();
    sub.fire();
    assert.equal(checks, 1);
    fg.fire();
    assert.equal(checks, 2);
    mock.timers.tick(4999);
    assert.equal(checks, 2);
    mock.timers.tick(1);
    assert.equal(checks, 3);
    mock.timers.tick(5000);
    assert.equal(checks, 4);
  });

  test("止めると 3 つともまとめて止まる", () => {
    const stop = start();
    stop();
    assert.equal(sub.count, 0);
    assert.equal(fg.count, 0);
    for (let i = 0; i < 12; i++) mock.timers.tick(5000);
    assert.equal(checks, 0);
  });

  test("間隔は回ごとに delay から決める", () => {
    let ms = 5000;
    start(() => ms);
    mock.timers.tick(5000);
    assert.equal(checks, 1);
    ms = 60000;
    mock.timers.tick(5000);
    assert.equal(checks, 2);
    mock.timers.tick(59999);
    assert.equal(checks, 2);
    mock.timers.tick(1);
    assert.equal(checks, 3);
  });
});

describe("waitPollDelay", () => {
  const T = Date.parse("2026-10-18T00:00:00Z");
  test("番号がまだ無いとき・期限の前は 5 秒", () => {
    assert.equal(WAIT_POLL_MS, 5000);
    assert.equal(waitPollDelay(T, null), WAIT_POLL_MS);
    assert.equal(waitPollDelay(T, T + 1), WAIT_POLL_MS);
  });
  test("期限を過ぎたら 60 秒", () => {
    assert.equal(WAIT_POLL_SLOW_MS, 60000);
    assert.equal(waitPollDelay(T, T), WAIT_POLL_SLOW_MS);
    assert.equal(waitPollDelay(T + 1, T), WAIT_POLL_SLOW_MS);
  });
});
