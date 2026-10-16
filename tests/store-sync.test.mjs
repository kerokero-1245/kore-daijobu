// ストア（src/data/store.tsx）の中身 consultationSync の楽観更新と巻き戻しを固定するテスト。
// 守るもの:
//   - 相談・返信・既読は、送る前に手元へ反映される（画面がすぐ変わる）
//   - 送れなかったら、相談は手元から消え、返信は元の返事待ちに戻り、syncError に理由が入る
//   - 既読の印は送れなくても戻さない（戻すと答えの画面が送り直し続けるため）が、syncError は入る
//   - 取り直しで届いた古い行が、送信中の手元の版を上書きしない
//   - 別の端末の書き込みが購読で届き、該当の 1 件が手元に入る
// バックエンドは FakeBackend（メモリ）。失敗はメソッドを差し替えて起こす。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { FakeBackend, createMemoryHub } =
  await import("../src/data/fakeBackend.ts");
const { createConsultationSync, SYNC_ERROR_MESSAGE } =
  await import("../src/data/consultationSync.ts");

async function setup() {
  const hub = createMemoryHub();
  let n = 0;
  const clock = { t: Date.parse("2026-10-16T00:00:00Z") };
  const newId = () =>
    `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
  const device = () =>
    new FakeBackend({ storage: hub.device(), newId, now: () => clock.t });
  const child = device();
  await child.signIn();
  await child.setRole("child");
  await child.createPair();
  const parent = device();
  await parent.signIn();
  await parent.setRole("parent");
  const { code } = await child.createInvite();
  await parent.redeemInvite(code);
  const { pairId } = await child.getPair();
  const syncOf = (backend) =>
    createConsultationSync({ backend, pairId, newId, now: () => clock.t });
  return { child, parent, pairId, clock, syncOf };
}

// 1 回だけ失敗させる。
function failOnce(backend, method) {
  const original = backend[method].bind(backend);
  backend[method] = async (...args) => {
    backend[method] = original;
    throw new Error(`${method}: offline`);
  };
}

describe("consultationSync: 楽観更新", () => {
  test("相談は送る前に手元の先頭に入り、送れたら相手の端末にも届く", async () => {
    const { child, parent, pairId, syncOf } = await setup();
    const sync = syncOf(parent);
    const id = sync.create("money");
    assert.deepEqual(
      sync.getState().consultations.map((c) => [c.id, c.status]),
      [[id, "waiting"]],
    );
    await sync.idle();
    assert.equal(sync.getState().syncError, undefined);
    const remote = await child.listConsultations(pairId, 50);
    assert.deepEqual(
      remote.map((c) => c.id),
      [id],
    );
  });

  test("返信は送る前に手元で answered になり、送れたらそのまま", async () => {
    const { child, parent, pairId, syncOf } = await setup();
    await parent.insertConsultation({ id: "c-1", pairId, category: "money" });
    const sync = syncOf(child);
    await sync.refresh();
    sync.reply("c-1", "danger", "それ詐欺かも");
    assert.equal(sync.getState().consultations[0].status, "answered");
    await sync.idle();
    assert.equal(
      sync.getState().consultations[0].reply.message,
      "それ詐欺かも",
    );
    assert.equal((await parent.getConsultation("c-1")).status, "answered");
  });

  test("変化を聞いている人に、手元の変化を知らせる", async () => {
    const { parent, syncOf } = await setup();
    const sync = syncOf(parent);
    let calls = 0;
    const stop = sync.subscribe(() => calls++);
    sync.create("refund");
    assert.ok(calls >= 1);
    stop();
    await sync.idle();
  });
});

describe("consultationSync: 送れなかったときの巻き戻し", () => {
  test("相談: 手元から消え、syncError が入る。DB にも残らない", async () => {
    const { child, parent, pairId, syncOf } = await setup();
    const sync = syncOf(parent);
    failOnce(parent, "insertConsultation");
    sync.create("money");
    assert.equal(sync.getState().consultations.length, 1);
    await sync.idle();
    assert.deepEqual(sync.getState().consultations, []);
    assert.equal(sync.getState().syncError, SYNC_ERROR_MESSAGE);
    assert.deepEqual(await child.listConsultations(pairId, 50), []);
  });

  test("相談: 他の相談は巻き戻しで消えない", async () => {
    const { parent, syncOf } = await setup();
    const sync = syncOf(parent);
    const kept = sync.create("money");
    await sync.idle();
    failOnce(parent, "insertConsultation");
    sync.create("other");
    await sync.idle();
    assert.deepEqual(
      sync.getState().consultations.map((c) => c.id),
      [kept],
    );
  });

  test("返信: 元の返事待ちに戻り、syncError が入る", async () => {
    const { child, parent, pairId, syncOf } = await setup();
    await parent.insertConsultation({ id: "c-1", pairId, category: "money" });
    const sync = syncOf(child);
    await sync.refresh();
    const before = sync.getState().consultations[0];
    failOnce(child, "insertReply");
    sync.reply("c-1", "safe", "大丈夫");
    assert.equal(sync.getState().consultations[0].status, "answered");
    await sync.idle();
    assert.deepEqual(sync.getState().consultations[0], before);
    assert.equal(sync.getState().syncError, SYNC_ERROR_MESSAGE);
  });

  test("既読: 送れなくても手元は戻さず、syncError は入る", async () => {
    const { child, parent, pairId, clock, syncOf } = await setup();
    await parent.insertConsultation({ id: "c-1", pairId, category: "money" });
    await child.insertReply("c-1", "danger", "それ詐欺かも");
    const sync = syncOf(parent);
    await sync.refresh();
    failOnce(parent, "markSeen");
    sync.markSeen("c-1");
    await sync.idle();
    assert.equal(sync.getState().consultations[0].parentSeenAt, clock.t);
    assert.equal(sync.getState().syncError, SYNC_ERROR_MESSAGE);
  });

  test("取り直しが成功すると syncError は消える", async () => {
    const { parent, syncOf } = await setup();
    const sync = syncOf(parent);
    failOnce(parent, "insertConsultation");
    sync.create("money");
    await sync.idle();
    assert.equal(sync.getState().syncError, SYNC_ERROR_MESSAGE);
    await sync.refresh();
    assert.equal(sync.getState().syncError, undefined);
  });
});

describe("consultationSync: 取り直しと購読", () => {
  test("送信中の相談は、取り直しで消えない", async () => {
    const { parent, syncOf } = await setup();
    const sync = syncOf(parent);
    // 送信を止めておき、その間に取り直す
    let release;
    const original = parent.insertConsultation.bind(parent);
    parent.insertConsultation = (c) =>
      new Promise((r) => (release = r)).then(() => original(c));
    const id = sync.create("money");
    await sync.refresh();
    assert.deepEqual(
      sync.getState().consultations.map((c) => c.id),
      [id],
    );
    release();
    await sync.idle();
    assert.deepEqual(
      sync.getState().consultations.map((c) => c.id),
      [id],
    );
  });

  test("別の端末の相談と返信が、購読で手元に入る", async () => {
    const { child, parent, syncOf } = await setup();
    const childSync = syncOf(child);
    const parentSync = syncOf(parent);
    const stopChild = childSync.start();
    const stopParent = parentSync.start();
    await childSync.idle();
    await parentSync.idle();

    const id = parentSync.create("construction");
    await parentSync.idle();
    await childSync.idle();
    assert.deepEqual(
      childSync.getState().consultations.map((c) => [c.id, c.status]),
      [[id, "waiting"]],
    );

    childSync.reply(id, "unsure", "一旦電話を切って");
    await childSync.idle();
    await parentSync.idle();
    const got = parentSync.getState().consultations[0];
    assert.equal(got.status, "answered");
    assert.equal(got.reply.message, "一旦電話を切って");
    stopChild();
    stopParent();
  });
});
