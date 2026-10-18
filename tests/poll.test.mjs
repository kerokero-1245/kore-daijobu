// 一定間隔で呼び続ける pollWhile（src/data/poll.ts）を固定するテスト。
// 守るもの:
//   - 始めた時点では呼ばず、間隔ごとに 1 回ずつ呼ぶ
//   - 止めたあとは呼ばない（子の待ち画面を離れたら読み直しが止まる）
// 時計は node:test の mock.timers で進める。setInterval と setTimeout の両方を偽物にする
// （同じ意味の書き換え＝setTimeout の連鎖でも落ちないように。片方だけだと本物のタイマーが残り、テストが終わらない）。
// 止める関数は afterEach で必ず呼ぶ（途中の assert で落ちても、タイマーを残さない）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

const { pollWhile } = await import("../src/data/poll.ts");

describe("pollWhile", () => {
  let stops = [];
  const start = (fn, ms) => {
    const stop = pollWhile(fn, ms);
    stops.push(stop);
    return stop;
  };
  beforeEach(() => mock.timers.enable({ apis: ["setInterval", "setTimeout"] }));
  afterEach(() => {
    for (const stop of stops) stop();
    stops = [];
    mock.timers.reset();
  });

  test("始めた時点では呼ばず、5 秒ごとに 1 回呼ぶ", () => {
    let n = 0;
    start(() => n++, 5000);
    assert.equal(n, 0);
    mock.timers.tick(4999);
    assert.equal(n, 0);
    mock.timers.tick(1);
    assert.equal(n, 1);
    // 間隔ごとに進める（mock.timers の tick は、進める間に新しく積まれたタイマーを同じ tick では呼ばない）。
    mock.timers.tick(5000);
    mock.timers.tick(5000);
    assert.equal(n, 3);
  });

  test("止めたあとは呼ばない", () => {
    let n = 0;
    const stop = start(() => n++, 5000);
    mock.timers.tick(5000);
    assert.equal(n, 1);
    stop();
    for (let i = 0; i < 12; i++) mock.timers.tick(5000);
    assert.equal(n, 1);
  });
});
