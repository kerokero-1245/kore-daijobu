// 番号の画面（src/screens/pairing/）の結線を、ソースの文字列で固定するテスト。
// なぜ: 状態遷移は純関数（pairingInput.ts）のテストで守るが、画面がその関数を呼ばなければ利用者には届かない。
// このリポジトリは React の画面を描いて押すテストを持たないので、押したときに呼ぶ関数だけを文字列で確かめる。
// 守るもの:
//   - 親の「消す」: 1 タップは eraseDigit、長押しは eraseAll。読み上げのヒントに「長押しで全部消す」
//   - 親の「つなぐ」: canSend で押せなくしない（押せるまま）。送れない状態で押したら sendBlockMessage の理由を
//     説明文の場所に出し、iOS は読み上げに通知する（子の返信の「送る」と同じ出し方）。説明文に押す手順を書く
//   - 子の番号の画面の「役割を選び直す」: session の restart（サインアウト → 新しい匿名ユーザーで読み直す。
//     ホームの「つなぎ直す」と同じ関数）を確かめずに呼ぶ。画面は signOut を自分で呼ばない
//     （サインアウトの呼び出しは src/data/session.tsx の 1 か所だけ）
//   - session.tsx の restart は、サインアウトの前に cancelPendingPair（自分が子の pending のペアと番号を消す）を呼ぶ。
//     失敗してもサインアウトと読み直しは止めない。呼ぶのは restart の 1 か所だけ（画面ごとに書かない）
//     （なぜ: 消さずにサインアウトすると、前の番号が期限まで使え、親が誰もいない匿名ユーザーとつながる）
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

describe("子の番号の画面（ChildPairingScreen.tsx）", () => {
  const src = source("ChildPairingScreen.tsx");

  test("「役割を選び直す」は session の restart を確かめずに呼ぶ", () => {
    const at = src.indexOf('label="役割を選び直す"');
    assert.ok(at >= 0, "「役割を選び直す」が見つからない");
    const tag = src.slice(
      src.lastIndexOf("<BigButton", at),
      src.indexOf("/>", at),
    );
    assert.ok(tag.includes("onPress={() => void restart()}"), tag);
    assert.match(src, /const \{[^}]*\brestart\b[^}]*\} = useSession\(\);/);
  });
});

describe("サインアウトの呼び出しは session.tsx の 1 か所だけ", () => {
  // src の .ts / .tsx を全部たどる（0 件なら失敗）。
  function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(new URL(`${e.name}/`, dir))
        : /\.tsx?$/.test(e.name)
          ? [new URL(e.name, dir)]
          : [],
    );
  }

  test("バックエンドの cancelPendingPair() を呼ぶのも src/data/session.tsx だけ", () => {
    const all = files(new URL("../src/", import.meta.url));
    assert.ok(all.length > 0, "src の .ts / .tsx が 0 件");
    const callers = all
      .filter((u) => /\.cancelPendingPair\(\)/.test(readFileSync(u, "utf8")))
      .map((u) => u.pathname.replace(/^.*\/src\//, "src/"));
    assert.deepEqual(callers, ["src/data/session.tsx"]);
  });

  test("restart は cancelPendingPair → signOut → load の順で呼び、cancelPendingPair の失敗では止まらない", () => {
    const src = readFileSync(
      new URL("../src/data/session.tsx", import.meta.url),
      "utf8",
    );
    const start = src.indexOf("const restart = useCallback(");
    assert.ok(start >= 0, "restart が見つからない");
    const body = src.slice(start, src.indexOf("}, [load]);", start));
    const cancel = body.indexOf(".cancelPendingPair()");
    const signOut = body.indexOf(".signOut()");
    const load = body.indexOf("await load()");
    assert.ok(cancel >= 0, `restart が cancelPendingPair を呼ばない:\n${body}`);
    assert.ok(cancel < signOut && signOut < load, body);
    // cancelPendingPair は自分の try の中（失敗しても signOut へ進む）。
    const tryAt = body.lastIndexOf("try {", cancel);
    const catchAt = body.indexOf("} catch", cancel);
    assert.ok(tryAt >= 0 && catchAt > cancel && catchAt < signOut, body);
  });

  test("バックエンドの signOut() を呼ぶのは src/data/session.tsx だけ", () => {
    const all = files(new URL("../src/", import.meta.url));
    assert.ok(all.length > 0, "src の .ts / .tsx が 0 件");
    const callers = all
      // supabase-js の auth.signOut() はバックエンドの中身なので数えない。
      .filter((u) => /(?<!auth)\.signOut\(\)/.test(readFileSync(u, "utf8")))
      .map((u) => u.pathname.replace(/^.*\/src\//, "src/"));
    assert.deepEqual(callers, ["src/data/session.tsx"]);
  });
});
