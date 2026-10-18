// 番号の画面（src/screens/pairing/）の結線を、ソースの文字列で固定するテスト。
// なぜ: 状態遷移は純関数（pairingInput.ts）のテストで守るが、画面がその関数を呼ばなければ利用者には届かない。
// このリポジトリは React の画面を描いて押すテストを持たないので、押したときに呼ぶ関数だけを文字列で確かめる。
// 守るもの:
//   - 親の「消す」: 1 タップは eraseDigit、長押しは eraseAll。読み上げのヒントに「長押しで全部消す」
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
});
