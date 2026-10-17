// 判定（verdict）ごとの表示情報（ラベル・見出し・色・定型文・表示順）を固定するテスト。
// 守るもの: 子の返信画面（定型文と判定の選択肢）と親の答え画面（見出しと色）が、同じ判定の表から引くこと。
// 判定を足したのに並び・色・定型文への追加を忘れる、表示順が入れ替わる、定型文が長すぎて送れない、
// といった食い違いをここで止める（Record の足し忘れは型でも止まる。並びの配列・定型文はここで止める）。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  REPLY_TEMPLATES,
  VERDICT_META,
  VERDICT_ORDER,
} from "../src/constants.ts";
import { MAX_REPLY_LENGTH } from "../src/domain/reply.ts";
import { verdictColor } from "../src/theme.ts";

test("判定ごとのラベル・見出し・絵の名前が、画面に出ている値と同じ", () => {
  assert.deepEqual(VERDICT_META, {
    danger: {
      label: "詐欺かも",
      headline: "詐欺かもしれません",
      icon: "verdict-danger",
    },
    safe: {
      label: "大丈夫そう",
      headline: "大丈夫そうです",
      icon: "verdict-safe",
    },
    unsure: {
      label: "まだ分からない",
      headline: "いったん待って",
      icon: "verdict-unsure",
    },
  });
});

test("自由入力の判定の選択肢の表示順は 詐欺かも → 大丈夫そう → まだ分からない", () => {
  assert.deepEqual(VERDICT_ORDER, ["danger", "safe", "unsure"]);
});

test("VERDICT_ORDER は VERDICT_META の全判定を 1 回ずつ含む（表から動的に列挙・0 件なら失敗）", () => {
  const keys = Object.keys(VERDICT_META);
  assert.ok(keys.length > 0, "表が空");
  assert.deepEqual([...VERDICT_ORDER].sort(), [...keys].sort());
  assert.equal(new Set(VERDICT_ORDER).size, VERDICT_ORDER.length, "並びに重複");
});

test("verdictColor は VERDICT_META と同じ判定を全部持ち、色は #RRGGBB", () => {
  const keys = Object.keys(VERDICT_META);
  assert.ok(keys.length > 0);
  assert.deepEqual(Object.keys(verdictColor).sort(), [...keys].sort());
  for (const key of keys) {
    assert.match(verdictColor[key], /^#[0-9A-F]{6}$/);
  }
});

test("定型文の並びと文面が、画面に出ている値と同じ（danger → unsure → safe）", () => {
  assert.deepEqual(REPLY_TEMPLATES, [
    { verdict: "danger", message: "それ詐欺かも！絶対に対応しないで" },
    { verdict: "unsure", message: "一旦電話を切って。あとでかけ直すね" },
    { verdict: "safe", message: "大丈夫、それは本物だよ" },
  ]);
});

test("定型文は全判定にあり、どれも空でなく、自由入力の上限以内（表から動的に列挙・0 件なら失敗）", () => {
  const keys = Object.keys(VERDICT_META);
  assert.ok(REPLY_TEMPLATES.length > 0, "定型文が 0 件");
  for (const key of keys) {
    assert.ok(
      REPLY_TEMPLATES.some((t) => t.verdict === key),
      `判定 ${key} の定型文が無い`,
    );
  }
  for (const t of REPLY_TEMPLATES) {
    assert.ok(keys.includes(t.verdict), `定型文の判定 ${t.verdict} が表に無い`);
    assert.ok(t.message.trim().length > 0);
    assert.ok(t.message.length <= MAX_REPLY_LENGTH);
  }
});
