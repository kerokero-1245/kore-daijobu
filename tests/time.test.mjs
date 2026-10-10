// formatTime（「10月11日 09:30」の形）を固定するテスト。
// 守るもの: 親ホーム・受信一覧・相談の詳細・読み上げ（accessibilityLabel）が、同じ書き方で時刻を出すこと。
// formatTime は端末のタイムゾーンで表示するので、TZ を日本時間に固定する（別の TZ の開発機・CI でも同じ結果にする）。
// 日付は Date.UTC で作り、日本時間（UTC+9）に直した値を期待値にする。
import assert from "node:assert/strict";
import { test } from "node:test";

import { formatTime } from "../src/domain/time.ts";

// import は先に評価されるが、formatTime は呼ばれたときに Date を作るので、ここで固定すれば間に合う。
process.env.TZ = "Asia/Tokyo";

test("前提: タイムゾーンが日本時間（UTC+9）に固定されている", () => {
  assert.equal(new Date(0).getTimezoneOffset(), -540);
});

test("月・日はゼロ埋めなし、時・分は 2 桁にゼロ埋めする", () => {
  // 2026-01-04 20:07 UTC = 2026-01-05 05:07 JST
  assert.equal(formatTime(Date.UTC(2026, 0, 4, 20, 7)), "1月5日 05:07");
});

test("月・日が 2 桁のときもそのまま出す", () => {
  // 2026-10-11 00:30 UTC = 2026-10-11 09:30 JST
  assert.equal(formatTime(Date.UTC(2026, 9, 11, 0, 30)), "10月11日 09:30");
});

test("日本時間で日付をまたぐ（UTC の 15:00 は日本時間の翌日 0:00）", () => {
  assert.equal(formatTime(Date.UTC(2025, 11, 31, 15, 0)), "1月1日 00:00");
});

test("0 時 0 分と 23 時 59 分", () => {
  assert.equal(formatTime(Date.UTC(2026, 5, 14, 15, 0)), "6月15日 00:00");
  assert.equal(formatTime(Date.UTC(2026, 5, 15, 14, 59)), "6月15日 23:59");
});

test("epoch 0 は日本時間の 1970 年 1 月 1 日 9:00", () => {
  assert.equal(formatTime(0), "1月1日 09:00");
});
