// 一定間隔で呼び続ける pollWhile（src/data/poll.ts）を固定するテスト。
// 守るもの:
//   - 始めた時点では呼ばず、間隔ごとに 1 回ずつ呼ぶ
//   - 止めたあとは呼ばない（子の待ち画面を離れたら読み直しが止まる）
// 時計は node:test の mock.timers で進める。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

const { pollWhile } = await import("../src/data/poll.ts");

describe("pollWhile", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setInterval"] }));
  afterEach(() => mock.timers.reset());

  test("始めた時点では呼ばず、5 秒ごとに 1 回呼ぶ", () => {
    let n = 0;
    const stop = pollWhile(() => n++, 5000);
    assert.equal(n, 0);
    mock.timers.tick(4999);
    assert.equal(n, 0);
    mock.timers.tick(1);
    assert.equal(n, 1);
    mock.timers.tick(10000);
    assert.equal(n, 3);
    stop();
  });

  test("止めたあとは呼ばない", () => {
    let n = 0;
    const stop = pollWhile(() => n++, 5000);
    mock.timers.tick(5000);
    assert.equal(n, 1);
    stop();
    mock.timers.tick(60000);
    assert.equal(n, 1);
  });
});
