// 親の番号入力の状態遷移（src/domain/pairingInput.ts）を固定するテスト。
// 守るもの: 6 桁そろっても自動では送らないこと、断られた番号は数字を変えるまで送り直せないこと
// （DB は失敗を毎回数え、回数超えの間に送った回も数えるので、1 タップの送り直しでロックが延び続ける）、
// 通信の失敗のときだけ同じ番号で送り直せること、まちがいが多いと断られたら窓の間は送れないこと、
// 送っている間は数字を変えられないこと。
// 「消す」の長押し（eraseAll）は数字を全部消すこと（1 タップの eraseDigit は 1 桁のまま）。期限切れ・使用済みの
// あとは残った 6 桁が使えないので、6 回押さずに打ち直せるように。数字を残す決定は変えない（長押しは利用者の明示の操作）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { test } from "node:test";

// src は拡張子なしで互いを import するので、解決の補いを入れてから動的 import で読む。
const { ATTEMPT_WINDOW_MS, INVITE_CODE_LENGTH } =
  await import("../src/domain/pairing.ts");
const {
  beginSend,
  canSend,
  eraseAll,
  eraseDigit,
  finishSend,
  initialPairingInput,
  pressDigit,
} = await import("../src/domain/pairingInput.ts");

const T0 = Date.parse("2026-10-18T00:00:00Z");

function typed(code, from = initialPairingInput) {
  return [...code].reduce((s, d) => pressDigit(s, d), from);
}

// 送って結果を受け取るまでを 1 回分進める。
function sendAndFinish(s, outcome, now = T0) {
  const sending = beginSend(s, now);
  assert.equal(sending.busy, true, "送れる状態で beginSend したら busy になる");
  return finishSend(sending, outcome, now);
}

// 最後の 1 桁だけ入れ直す（1 桁変える）。
function changeLastDigit(s) {
  const last = s.code.at(-1);
  return pressDigit(
    eraseDigit(s),
    last === "9" ? "0" : String(Number(last) + 1),
  );
}

test("6 桁そろっても送る状態にならない（自動では送らない）。7 桁目は入らない", () => {
  let s = initialPairingInput;
  for (const d of "123456") {
    s = pressDigit(s, d);
    assert.equal(s.busy, false, `「${d}」を押しても送り始めない`);
  }
  assert.equal(s.code, "123456");
  assert.equal(s.code.length, INVITE_CODE_LENGTH);
  assert.equal(canSend(s, T0), true, "6 桁そろうと押せる");
  assert.equal(pressDigit(s, "7").code, "123456");
});

test("6 桁未満では押せない", () => {
  assert.equal(canSend(initialPairingInput, T0), false);
  assert.equal(canSend(typed("12345"), T0), false);
  assert.equal(beginSend(typed("12345"), T0).busy, false);
});

for (const reason of [
  "invalid",
  "used",
  "expired",
  "not_parent",
  "already_paired",
]) {
  test(`${reason} で断られた番号は、数字を残したまま押せない。1 桁変えると押せる`, () => {
    const s = sendAndFinish(typed("307114"), reason);
    assert.equal(s.code, "307114", "数字は残す");
    assert.equal(s.failure, reason, "理由を出す");
    assert.equal(s.busy, false);
    assert.equal(canSend(s, T0), false, "同じ番号のままでは押せない");
    assert.equal(beginSend(s, T0), s, "押しても送り始めない");

    const changed = changeLastDigit(s);
    assert.notEqual(changed.code, s.code);
    assert.equal(canSend(changed, T0), true, "1 桁変えると押せる");
  });
}

test("1 桁消して同じ数字を入れ直し、断られた番号に戻ると、また押せない", () => {
  const s = sendAndFinish(typed("307114"), "invalid");
  const back = pressDigit(eraseDigit(s), "4");
  assert.equal(back.code, "307114");
  assert.equal(canSend(back, T0), false);
});

test("通信の失敗（send_error）の後は、同じ番号のまま押せる", () => {
  const s = sendAndFinish(typed("307113"), "send_error");
  assert.equal(s.code, "307113");
  assert.equal(s.failure, "send_error");
  assert.equal(canSend(s, T0), true);
});

test("断られた番号を直した後に通信が失敗しても、直した番号は押せる・元の番号は押せないまま", () => {
  const rejected = sendAndFinish(typed("307114"), "invalid");
  const fixed = changeLastDigit(rejected);
  const failed = sendAndFinish(fixed, "send_error");
  assert.equal(canSend(failed, T0), true);
  const back = pressDigit(eraseDigit(failed), "4");
  assert.equal(back.code, "307114");
  assert.equal(canSend(back, T0), false);
});

test("too_many_attempts の後は、数字を変えても窓の間は押せず、窓が過ぎると押せる", () => {
  const s = sendAndFinish(typed("307114"), "too_many_attempts", T0);
  assert.equal(s.failure, "too_many_attempts");
  assert.equal(canSend(s, T0), false, "直後は押せない");
  const changed = changeLastDigit(s);
  assert.equal(canSend(changed, T0 + 1), false, "数字を変えても押せない");
  assert.equal(
    canSend(changed, T0 + ATTEMPT_WINDOW_MS - 1),
    false,
    "窓の終わりの直前も押せない",
  );
  assert.equal(beginSend(changed, T0 + ATTEMPT_WINDOW_MS - 1), changed);
  assert.equal(
    canSend(changed, T0 + ATTEMPT_WINDOW_MS),
    true,
    "窓が過ぎると押せる",
  );
  assert.equal(
    canSend(s, T0 + ATTEMPT_WINDOW_MS),
    true,
    "回数で断られた番号そのものは、窓が過ぎれば押せる",
  );
});

test("送っている間（busy）は、数字キーも消すも効かず、もう一度は送れない", () => {
  const sending = beginSend(typed("307113"), T0);
  assert.equal(sending.busy, true);
  assert.equal(pressDigit(sending, "1"), sending);
  assert.equal(eraseDigit(sending), sending);
  assert.equal(canSend(sending, T0), false);
  assert.equal(beginSend(sending, T0), sending);

  const partial = { ...typed("3071"), busy: true };
  assert.equal(
    pressDigit(partial, "1"),
    partial,
    "6 桁未満でも busy なら入らない",
  );
});

test("数字を足すと理由の文は消える。消すでは理由の文は残る", () => {
  const s = sendAndFinish(typed("307114"), "invalid");
  assert.equal(eraseDigit(s).failure, "invalid");
  assert.equal(pressDigit(eraseDigit(s), "5").failure, null);
});

test("送り始めると前の理由の文は消え、ok なら理由は出さない", () => {
  const failed = sendAndFinish(typed("307113"), "send_error");
  const sending = beginSend(failed, T0);
  assert.equal(sending.failure, null);
  const done = finishSend(sending, "ok", T0);
  assert.equal(done.busy, false);
  assert.equal(done.failure, null);
});

test("「消す」の長押し（eraseAll）は数字を全部消す。1 タップ（eraseDigit）は 1 桁のまま", () => {
  const s = typed("307114");
  assert.equal(eraseDigit(s).code, "30711", "1 タップは 1 桁");
  assert.equal(eraseAll(s).code, "", "長押しは全部");
  assert.equal(eraseAll(typed("3")).code, "");
  assert.equal(
    eraseAll(initialPairingInput),
    initialPairingInput,
    "空なら変えない",
  );
});

test("期限切れ・使用済みで断られたあと、長押しで全部消して打ち直すと押せる。失敗の直後は数字が残る", () => {
  for (const reason of ["expired", "used"]) {
    const failed = sendAndFinish(typed("307114"), reason);
    assert.equal(failed.code, "307114", "失敗しても数字は残す");
    const cleared = eraseAll(failed);
    assert.equal(cleared.code, "");
    assert.equal(canSend(typed("518220", cleared), T0), true);
  }
});

test("送っている間（busy）は長押しでも消えない", () => {
  const sending = beginSend(typed("307113"), T0);
  assert.equal(eraseAll(sending), sending);
});
