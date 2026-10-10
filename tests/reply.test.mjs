// 子の自由入力の返信（文面 + 判定）の検査を固定するテスト。
// 守るもの: 「この内容で送る」を押したとき、文面なし・判定なし・両方なしのどれで送れないかを、
// 画面に出す順（文面 → 判定）の理由リストで返すこと。空なら送れる。
import assert from "node:assert/strict";
import { test } from "node:test";

import { freeReplyErrors, MAX_REPLY_LENGTH } from "../src/domain/reply.ts";

const NO_TEXT = "返信の文面を入力してください";
const NO_VERDICT = "判定を選んでください";

test("文面なし・判定なし → 両方の理由を、文面 → 判定の順で返す", () => {
  assert.deepEqual(freeReplyErrors("", null), [NO_TEXT, NO_VERDICT]);
});

test("文面なしだけ → 文面の理由だけ", () => {
  assert.deepEqual(freeReplyErrors("", "danger"), [NO_TEXT]);
});

test("判定なしだけ → 判定の理由だけ", () => {
  assert.deepEqual(freeReplyErrors("それは詐欺です", null), [NO_VERDICT]);
});

test("文面も判定もある → 理由なし（送れる）", () => {
  assert.deepEqual(freeReplyErrors("それは詐欺です", "danger"), []);
});

test("判定はどの種類を選んでも判定の理由は出ない（動的に列挙・0 件なら失敗）", () => {
  const verdicts = ["danger", "safe", "unsure"];
  assert.ok(verdicts.length > 0);
  for (const v of verdicts) {
    assert.deepEqual(freeReplyErrors("ok", v), []);
  }
});

test("空白だけの文面は「文面なし」として扱う（半角・全角スペース・改行・タブ）", () => {
  for (const blank of [" ", "   ", "　", "\n", "\t", " \n　\t "]) {
    assert.deepEqual(
      freeReplyErrors(blank, "safe"),
      [NO_TEXT],
      JSON.stringify(blank),
    );
  }
});

test("前後に空白があっても、中身があれば文面ありとして扱う", () => {
  assert.deepEqual(freeReplyErrors("  大丈夫  ", "safe"), []);
});

test("自由入力の返信の上限は 200 字（画面の「200字まで」と DESIGN の値）", () => {
  assert.equal(MAX_REPLY_LENGTH, 200);
});
