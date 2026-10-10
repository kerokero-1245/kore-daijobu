// 相談（Consultation）の判定・並べ替え・更新を固定するテスト。
// 守るもの:
//   - 「答えが届いて親がまだ開いていない」判定が 1 つで、親ホーム・答えの画面・ストアで同じ結果になること
//   - 親ホームの並び順（開いていない答え → 返事待ち → 開いた答え、同じ組は新しい順、最大 3 件）
//   - 返信の適用と既読の記録が、元の配列・元の相談を変えず、対象外のときは同じ配列を返すこと
//   - 相談オブジェクトの形（id / category / photoUri / status / createdAt、返信は verdict / message / createdAt）。
//     Supabase に移すときの行の形の前提なので、リファクタで変えない
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  MAX_ENTRIES,
  answeredReply,
  applyReply,
  entryKind,
  entryLabel,
  entryRank,
  isAnswered,
  isUnseenAnswer,
  newConsultation,
  pickEntries,
  recordAnswerSeen,
} from "../src/domain/consultation.ts";

// ---- 作り方の道具 ----
const waiting = (id, createdAt) => ({
  id,
  category: "money",
  photoUri: undefined,
  status: "waiting",
  createdAt,
});
const answered = (id, createdAt, parentSeenAt) => ({
  id,
  category: "money",
  photoUri: undefined,
  status: "answered",
  createdAt,
  reply: { verdict: "danger", message: `返信 ${id}`, createdAt: createdAt + 1 },
  ...(parentSeenAt === undefined ? {} : { parentSeenAt }),
});
const unseen = (id, createdAt) => answered(id, createdAt);
const seen = (id, createdAt) => answered(id, createdAt, createdAt + 100);

// 中身まで凍らせる。関数が元の配列・相談を書き換えたら TypeError で落ちる。
function deepFreeze(o) {
  Object.freeze(o);
  for (const v of Object.values(o)) {
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v);
  }
  return o;
}
const ids = (list) => list.map((c) => c.id);

describe("答えの有無・未読の判定", () => {
  test("isAnswered: 返信済みだけ true", () => {
    assert.equal(isAnswered(waiting("a", 1)), false);
    assert.equal(isAnswered(unseen("a", 1)), true);
    assert.equal(isAnswered(seen("a", 1)), true);
  });

  test("answeredReply: 返信済みならその返信、返事待ちなら undefined", () => {
    const a = unseen("a", 1);
    assert.equal(answeredReply(a), a.reply);
    assert.equal(answeredReply(waiting("w", 1)), undefined);
  });

  test("answeredReply: status が返事待ちなら、reply が付いていても undefined（status で決める）", () => {
    const odd = { ...waiting("w", 1), reply: unseen("a", 1).reply };
    assert.equal(answeredReply(odd), undefined);
  });

  test("isUnseenAnswer: 答えが届いて、親がまだ開いていないときだけ true", () => {
    assert.equal(isUnseenAnswer(unseen("a", 1)), true);
    assert.equal(isUnseenAnswer(seen("a", 1)), false);
    assert.equal(isUnseenAnswer(waiting("w", 1)), false);
  });

  test("isUnseenAnswer: 返事待ちは、parentSeenAt が付いていても false", () => {
    assert.equal(
      isUnseenAnswer({ ...waiting("w", 1), parentSeenAt: 5 }),
      false,
    );
  });
});

describe("親ホームの入口の種類・順位・文言", () => {
  test("entryKind と entryRank: 開いていない答え 0 → 返事待ち 1 → 開いた答え 2", () => {
    assert.deepEqual(
      [unseen("u", 1), waiting("w", 1), seen("s", 1)].map((c) => [
        entryKind(c),
        entryRank(c),
      ]),
      [
        ["unseenAnswer", 0],
        ["waiting", 1],
        ["seenAnswer", 2],
      ],
    );
  });

  test("entryLabel: 種類ごとの絵文字と文言", () => {
    assert.deepEqual(entryLabel(unseen("u", 1)), {
      emoji: "📩",
      label: "答えが届きました",
    });
    assert.deepEqual(entryLabel(waiting("w", 1)), {
      emoji: "⏳",
      label: "返事を待っています",
    });
    assert.deepEqual(entryLabel(seen("s", 1)), {
      emoji: "✔️",
      label: "確認ずみの答え",
    });
  });
});

describe("pickEntries（親ホームに出す相談の並び）", () => {
  test("上限は 3 件", () => {
    assert.equal(MAX_ENTRIES, 3);
  });

  test("3 種の並び: 開いていない答え → 返事待ち → 開いた答え（入力の順番によらない）", () => {
    const u = unseen("u", 10);
    const w = waiting("w", 20);
    const s = seen("s", 30);
    for (const input of [
      [s, w, u],
      [w, s, u],
      [u, w, s],
      [s, u, w],
    ]) {
      assert.deepEqual(ids(pickEntries(input)), ["u", "w", "s"]);
    }
  });

  test("同じ種類の中は新しい順（開いていない答え）", () => {
    const list = [unseen("a", 1), unseen("c", 3), unseen("b", 2)];
    assert.deepEqual(ids(pickEntries(list)), ["c", "b", "a"]);
  });

  test("同じ種類の中は新しい順（返事待ち）", () => {
    const list = [waiting("a", 1), waiting("c", 3), waiting("b", 2)];
    assert.deepEqual(ids(pickEntries(list)), ["c", "b", "a"]);
  });

  test("同じ種類の中は新しい順（開いた答え）", () => {
    const list = [seen("a", 1), seen("c", 3), seen("b", 2)];
    assert.deepEqual(ids(pickEntries(list)), ["c", "b", "a"]);
  });

  test("新しさより種類が先（古い開いていない答えが、新しい返事待ちより上）", () => {
    const list = [
      waiting("new-w", 100),
      unseen("old-u", 1),
      seen("new-s", 200),
    ];
    assert.deepEqual(ids(pickEntries(list)), ["old-u", "new-w", "new-s"]);
  });

  test("最大 3 件: 順位の高い 3 件だけ残す", () => {
    const list = [
      seen("s1", 10),
      waiting("w1", 20),
      unseen("u1", 30),
      seen("s2", 40),
      waiting("w2", 50),
    ];
    const picked = pickEntries(list);
    assert.equal(picked.length, MAX_ENTRIES);
    assert.deepEqual(ids(picked), ["u1", "w2", "w1"]);
  });

  test("3 件以下ならそのまま全部並べる・空なら空", () => {
    assert.deepEqual(ids(pickEntries([waiting("a", 1), seen("b", 2)])), [
      "a",
      "b",
    ]);
    assert.deepEqual(pickEntries([]), []);
  });

  test("元の配列を変えない（並べ替えは複製に対して行う）", () => {
    const list = deepFreeze([seen("s", 1), waiting("w", 2), unseen("u", 3)]);
    assert.deepEqual(ids(pickEntries(list)), ["u", "w", "s"]);
    assert.deepEqual(ids(list), ["s", "w", "u"]);
  });
});

describe("newConsultation（相談オブジェクトの形）", () => {
  test("キーは id / category / photoUri / status / createdAt の 5 つだけ", () => {
    const c = newConsultation("id-1", "refund", undefined, 1234);
    assert.deepEqual(Object.keys(c), [
      "id",
      "category",
      "photoUri",
      "status",
      "createdAt",
    ]);
    assert.deepEqual(c, {
      id: "id-1",
      category: "refund",
      photoUri: undefined,
      status: "waiting",
      createdAt: 1234,
    });
  });

  test("photoUri は渡されなくてもキーを持つ（値は undefined）", () => {
    const c = newConsultation("id-1", "money", undefined, 1);
    assert.ok("photoUri" in c);
    assert.equal(c.photoUri, undefined);
  });

  test("photoUri を渡したらそのまま持つ", () => {
    assert.equal(
      newConsultation("id-1", "money", "file:///a.jpg", 1).photoUri,
      "file:///a.jpg",
    );
  });

  test("できた相談は返事待ちで、reply・parentSeenAt のキーは持たない", () => {
    const c = newConsultation("id-1", "other", undefined, 1);
    assert.equal(isAnswered(c), false);
    assert.ok(!("reply" in c));
    assert.ok(!("parentSeenAt" in c));
  });
});

describe("applyReply（返信の適用）", () => {
  test("対象の相談に返信が付いて、status が answered になる（返信は verdict / message / createdAt）", () => {
    const before = deepFreeze([waiting("a", 1), waiting("b", 2)]);
    const after = applyReply(before, "b", "safe", "大丈夫だよ", 999);
    assert.equal(after.length, 2);
    assert.deepEqual(after[1], {
      id: "b",
      category: "money",
      photoUri: undefined,
      status: "answered",
      createdAt: 2,
      reply: { verdict: "safe", message: "大丈夫だよ", createdAt: 999 },
    });
    assert.deepEqual(Object.keys(after[1].reply), [
      "verdict",
      "message",
      "createdAt",
    ]);
  });

  test("対象外の相談は同じ参照のまま、元の配列と元の相談は変えない", () => {
    const a = waiting("a", 1);
    const before = deepFreeze([a, waiting("b", 2)]);
    const after = applyReply(before, "b", "danger", "x", 5);
    assert.notEqual(after, before);
    assert.equal(after[0], a);
    assert.equal(before[1].status, "waiting");
    assert.ok(!("reply" in before[1]));
  });

  test("対象が無いときは同じ配列をそのまま返す", () => {
    const before = deepFreeze([waiting("a", 1)]);
    assert.equal(applyReply(before, "zzz", "danger", "x", 5), before);
    const empty = [];
    assert.equal(applyReply(empty, "a", "danger", "x", 5), empty);
  });

  test("返信後の相談は「開いていない答え」になる（parentSeenAt はまだ無い）", () => {
    const after = applyReply([waiting("a", 1)], "a", "unsure", "待って", 7);
    assert.equal(isUnseenAnswer(after[0]), true);
    assert.ok(!("parentSeenAt" in after[0]));
  });
});

describe("recordAnswerSeen（既読の記録）", () => {
  test("開いていない答えに parentSeenAt が入る。ほかの値と他の相談は変わらない", () => {
    const other = waiting("w", 1);
    const target = unseen("u", 2);
    const before = deepFreeze([other, target]);
    const after = recordAnswerSeen(before, "u", 555);
    assert.notEqual(after, before);
    assert.equal(after[0], other);
    assert.deepEqual(after[1], { ...target, parentSeenAt: 555 });
    assert.ok(!("parentSeenAt" in before[1]));
    assert.equal(isUnseenAnswer(after[1]), false);
  });

  test("返事待ちの相談は同じ配列を返す（変化なし）", () => {
    const before = deepFreeze([waiting("w", 1)]);
    assert.equal(recordAnswerSeen(before, "w", 5), before);
  });

  test("すでに記録済みなら同じ配列を返し、時刻を上書きしない", () => {
    const before = deepFreeze([seen("s", 1)]);
    const after = recordAnswerSeen(before, "s", 9999);
    assert.equal(after, before);
    assert.equal(after[0].parentSeenAt, 101);
  });

  test("対象が無いときは同じ配列を返す", () => {
    const before = deepFreeze([unseen("u", 1)]);
    assert.equal(recordAnswerSeen(before, "zzz", 5), before);
    const empty = [];
    assert.equal(recordAnswerSeen(empty, "u", 5), empty);
  });
});
