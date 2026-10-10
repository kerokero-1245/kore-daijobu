// 画面に出る呼び名・アプリ名の定数を固定するテスト。
// 守るもの: 親の画面に出る「たろう さん」の呼び名（4 か所）とアプリ名「これ、大丈夫？」（4 か所）が、
// 1 つの定義から作られ、画面に出る文字が変わらないこと。
// 親ホームの大ボタンだけ「これ、」と「大丈夫？」の間で改行するので、その形も固定する。
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APP_NAME,
  APP_NAME_TWO_LINES,
  CHILD_CALL_NAME,
  callName,
} from "../src/constants.ts";

test("callName: 名前に半角スペースと「さん」を付ける", () => {
  assert.equal(callName("たろう"), "たろう さん");
  assert.equal(callName("Hanako"), "Hanako さん");
});

test("子の呼び名は 仮の名前「たろう」+ さん（画面に出ている値）", () => {
  assert.equal(CHILD_CALL_NAME, "たろう さん");
  assert.equal(CHILD_CALL_NAME, callName("たろう"));
});

test("アプリ名は「これ、大丈夫？」（読点あり。app.json のホーム画面の名前「これ大丈夫？」とは別）", () => {
  assert.equal(APP_NAME, "これ、大丈夫？");
});

test("大ボタン用のアプリ名は「これ、」と「大丈夫？」の間で改行し、改行を除けばアプリ名と同じ", () => {
  assert.equal(APP_NAME_TWO_LINES, "これ、\n大丈夫？");
  assert.equal(APP_NAME_TWO_LINES.replace("\n", ""), APP_NAME);
  assert.equal(APP_NAME_TWO_LINES.split("\n").length, 2);
});
