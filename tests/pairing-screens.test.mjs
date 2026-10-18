// 番号の画面（src/screens/pairing/）の結線を、ソースの文字列で固定するテスト。
// なぜ: 状態遷移は純関数（pairingInput.ts）のテストで守るが、画面がその関数を呼ばなければ利用者には届かない。
// このリポジトリは React の画面を描いて押すテストを持たないので、押したときに呼ぶ関数だけを文字列で確かめる。
// 守るもの:
//   - 親の「消す」: 1 タップは eraseDigit、長押しは eraseAll。読み上げのヒントに「長押しで全部消す」
//   - 親の「つなぐ」: canSend で押せなくしない（押せるまま）。送れない状態で押したら sendBlockMessage の理由を
//     説明文の場所に出し、iOS は読み上げに通知する（子の返信の「送る」と同じ出し方）。説明文に押す手順を書く
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

function source(file) {
  return readFileSync(
    new URL(`../src/screens/pairing/${file}`, import.meta.url),
    "utf8",
  );
}

// accessibilityLabel="<label>" を持つ要素の開きタグ（<Pressable ... >）を取り出す。見つからなければ失敗。
function openingTagWithLabel(src, label) {
  const at = src.indexOf(`accessibilityLabel="${label}"`);
  assert.ok(at >= 0, `accessibilityLabel="${label}" が見つからない`);
  const start = src.lastIndexOf("<Pressable", at);
  const end = src.indexOf(">\n", at);
  assert.ok(start >= 0 && end > at, `「${label}」の開きタグが取れない`);
  return src.slice(start, end);
}

describe("親の番号入力（ParentPairingScreen.tsx）", () => {
  const src = source("ParentPairingScreen.tsx");

  test("「消す」は 1 タップで eraseDigit、長押しで eraseAll を呼ぶ", () => {
    const tag = openingTagWithLabel(src, "消す");
    assert.ok(tag.includes("onPress={erase}"), tag);
    assert.ok(src.includes("const erase = () => setInput(eraseDigit);"));
    assert.ok(tag.includes("onLongPress={() => setInput(eraseAll)}"), tag);
    assert.match(tag, /accessibilityHint="[^"]*長押しで全部消す[^"]*"/);
  });

  test("「つなぐ」は canSend で押せなくせず、押せないのは送っている間だけ", () => {
    const at = src.indexOf('label="つなぐ"');
    assert.ok(at >= 0, "「つなぐ」が見つからない");
    const tag = src.slice(
      src.lastIndexOf("<BigButton", at),
      src.indexOf("/>", at),
    );
    assert.ok(!tag.includes("canSend"), tag);
    assert.ok(tag.includes("onPress={submit}"), tag);
    assert.ok(tag.includes("disabled={busy}"), tag);
  });

  test("送れない状態で押したら、理由を画面に出し、iOS は読み上げに通知する", () => {
    assert.ok(src.includes("sendBlockMessage(input, now)"));
    assert.ok(src.includes("sendBlockMessage(next, t)"));
    assert.ok(src.includes('Platform.OS === "ios"'));
    assert.ok(src.includes("AccessibilityInfo.announceForAccessibility("));
  });

  test("説明文に「6 桁入れて「つなぐ」を押してください」がある", () => {
    assert.ok(src.includes("6 桁入れて「つなぐ」を押してください"));
  });
});
