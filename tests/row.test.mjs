// DB の行を Consultation に読み替える rowToConsultation を固定するテスト。
// 守るもの:
//   - 返事待ち・答えありの正しい行は、画面が使う形（id / category / photoUri / status / createdAt、
//     返信は verdict / message / createdAt、親が開いた時刻は parentSeenAt）に読める
//   - status と返信の組が合わない行（返事待ちで返信あり・答えありで返信なし・返事待ちで開いた時刻あり）は null
//   - 知らない status・判定・壊れた時刻・行でない値は null。知らない種類は other に寄せる（落とさない）
//   - 返信の埋め込みは 1 件のオブジェクトでも、0〜1 件の配列でも読める（2 件以上は null）
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { rowToConsultation } from "../src/domain/row.ts";

const T0 = "2026-10-16T01:00:00.000Z";
const T1 = "2026-10-16T01:05:00.000Z";
const T2 = "2026-10-16T01:10:00.000Z";

const waitingRow = (extra = {}) => ({
  id: "c1",
  category: "money",
  photo_path: null,
  status: "waiting",
  parent_seen_at: null,
  created_at: T0,
  replies: null,
  ...extra,
});
const reply = { verdict: "danger", message: "それ詐欺かも", created_at: T1 };
const answeredRow = (extra = {}) =>
  waitingRow({ status: "answered", replies: reply, ...extra });

describe("rowToConsultation: 正しい行", () => {
  test("返事待ちの行は waiting の相談になり、reply を持たない", () => {
    assert.deepEqual(rowToConsultation(waitingRow()), {
      id: "c1",
      category: "money",
      photoUri: undefined,
      status: "waiting",
      createdAt: Date.parse(T0),
    });
  });

  test("答えの行は answered の相談になり、返信の時刻も epoch ms に読む", () => {
    assert.deepEqual(rowToConsultation(answeredRow()), {
      id: "c1",
      category: "money",
      photoUri: undefined,
      status: "answered",
      createdAt: Date.parse(T0),
      reply: {
        verdict: "danger",
        message: "それ詐欺かも",
        createdAt: Date.parse(T1),
      },
    });
  });

  test("親が開いた時刻は parentSeenAt に入る", () => {
    const c = rowToConsultation(answeredRow({ parent_seen_at: T2 }));
    assert.equal(c?.parentSeenAt, Date.parse(T2));
  });

  test("返信の埋め込みが配列（1 件・0 件）でも読める", () => {
    assert.equal(
      rowToConsultation(answeredRow({ replies: [reply] }))?.status,
      "answered",
    );
    assert.equal(
      rowToConsultation(waitingRow({ replies: [] }))?.status,
      "waiting",
    );
  });

  test("photo_path は photoUri に入る", () => {
    assert.equal(
      rowToConsultation(waitingRow({ photo_path: "p/1.jpg" }))?.photoUri,
      "p/1.jpg",
    );
  });

  test("知らない種類は other に寄せる（新しい種類を古いアプリが受けても落とさない）", () => {
    assert.equal(
      rowToConsultation(waitingRow({ category: "new_kind" }))?.category,
      "other",
    );
  });
});

describe("rowToConsultation: status と返信の組が合わない行は null", () => {
  test("返事待ちなのに返信がある", () => {
    assert.equal(rowToConsultation(waitingRow({ replies: reply })), null);
  });
  test("答えありなのに返信が無い", () => {
    assert.equal(rowToConsultation(answeredRow({ replies: null })), null);
    assert.equal(rowToConsultation(answeredRow({ replies: [] })), null);
  });
  test("返事待ちなのに親が開いた時刻がある", () => {
    assert.equal(rowToConsultation(waitingRow({ parent_seen_at: T2 })), null);
  });
  test("返信が 2 件ある（1 相談 1 返信に反する）", () => {
    assert.equal(
      rowToConsultation(answeredRow({ replies: [reply, reply] })),
      null,
    );
  });
});

describe("rowToConsultation: 不明な値・壊れた値は null", () => {
  const cases = [
    ["知らない status", answeredRow({ status: "closed" })],
    ["知らない判定", answeredRow({ replies: { ...reply, verdict: "maybe" } })],
    [
      "返信の文面が文字列でない",
      answeredRow({ replies: { ...reply, message: 1 } }),
    ],
    [
      "返信の時刻が読めない",
      answeredRow({ replies: { ...reply, created_at: "x" } }),
    ],
    ["作成時刻が読めない", waitingRow({ created_at: "not a date" })],
    ["作成時刻が無い", waitingRow({ created_at: undefined })],
    ["開いた時刻が読めない", answeredRow({ parent_seen_at: "x" })],
    ["id が無い", waitingRow({ id: undefined })],
    ["id が空", waitingRow({ id: "" })],
    ["種類が文字列でない", waitingRow({ category: 3 })],
    ["photo_path が文字列でない", waitingRow({ photo_path: 3 })],
  ];
  for (const [name, row] of cases) {
    test(name, () => assert.equal(rowToConsultation(row), null));
  }
  test("行でない値（null・配列・文字列・数）", () => {
    for (const v of [null, undefined, [], "row", 1]) {
      assert.equal(rowToConsultation(v), null);
    }
  });
});
