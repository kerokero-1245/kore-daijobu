// サインインとペアの状態を読む createSessionLoader（src/data/sessionLoader.ts）を固定するテスト。
// 守るもの:
//   - 重なった読み込み（起動時・役割を選んだとき・番号を引き換えたとき・待つ間の読み直し）は、
//     後から始めた読み込みの結果がもう入っていたら、先に始めた方の結果も失敗も画面に入れない
//     （受信一覧 → 番号の画面 → 受信一覧と揺れない。成功の後に古い失敗が着いてエラー画面にならない）
//   - 待つ間の読み直しの失敗は画面に上げない
//   - 待つ間の読み直しは getPair だけを読み、つながったときだけ全部を読み直す
//   - 番号の引き換えが DB では済んだのに応答が失われたとき（送れなかった → 押し直すと used・already_paired）、
//     読み直してホームへ進む（アプリを終了して開き直すまで番号の画面に残らない）
// バックエンドは手で応答を返せる偽物（呼ばれた順に応答を決める）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { createSessionLoader, LOAD_ERROR } =
  await import("../src/data/sessionLoader.ts");
const { FakeBackend, createMemoryHub } =
  await import("../src/data/fakeBackend.ts");

// getPair の応答を呼ばれた順に手で返せる偽のバックエンド（役割は親か子で固定）。
function deferredBackend(role) {
  const pairs = [];
  const calls = { signIn: 0, getRole: 0, getPair: 0, createPair: 0 };
  const backend = {
    async signIn() {
      calls.signIn++;
      return "me";
    },
    async getRole() {
      calls.getRole++;
      return role;
    },
    getPair() {
      calls.getPair++;
      return new Promise((resolve, reject) => pairs.push({ resolve, reject }));
    },
    async createPair() {
      calls.createPair++;
      return "p-1";
    },
  };
  return { backend, pairs, calls };
}

// 約束が片付くまで待つ（readState の中の await を進める）。
const flush = () => new Promise((r) => setImmediate(r));

function setup(role) {
  const d = deferredBackend(role);
  const applied = [];
  const loader = createSessionLoader({
    backend: () => d.backend,
    apply: (s) => applied.push(s),
  });
  return { ...d, applied, loader };
}

const ACTIVE = { pairId: "p-1", role: "parent", status: "active" };

describe("sessionLoader: 重なった読み込みの順番", () => {
  test("先に始めた load の古い結果が後から着いても、新しい結果を上書きしない", async () => {
    const { pairs, applied, loader } = setup("parent");
    const first = loader.load();
    await flush();
    const second = loader.load();
    await flush();
    pairs[1].resolve(ACTIVE);
    await second;
    pairs[0].resolve(null);
    await first;
    assert.deepEqual(applied, [
      { status: "paired", role: "parent", pairId: "p-1" },
    ]);
  });

  test("先に始めた load の失敗が、後の成功の後に着いてもエラー画面にしない", async () => {
    const { pairs, applied, loader } = setup("parent");
    const first = loader.load();
    await flush();
    const second = loader.load();
    await flush();
    pairs[1].resolve(ACTIVE);
    await second;
    pairs[0].reject(new Error("pairs: offline"));
    await first;
    assert.deepEqual(applied, [
      { status: "paired", role: "parent", pairId: "p-1" },
    ]);
  });

  test("後の load が走っている間に先の load が失敗しても、エラー画面にせず後の結果を待つ", async () => {
    const { pairs, applied, loader } = setup("parent");
    const first = loader.load();
    await flush();
    const second = loader.load();
    await flush();
    pairs[0].reject(new Error("pairs: offline"));
    await first;
    assert.deepEqual(applied, []);
    pairs[1].resolve(ACTIVE);
    await second;
    assert.deepEqual(applied, [
      { status: "paired", role: "parent", pairId: "p-1" },
    ]);
  });

  test("始めた順に着いたら、どちらの結果も入る", async () => {
    const { pairs, applied, loader } = setup("parent");
    const first = loader.load();
    await flush();
    const second = loader.load();
    await flush();
    pairs[0].resolve(null);
    await first;
    pairs[1].resolve(ACTIVE);
    await second;
    assert.deepEqual(applied, [
      { status: "parent_unpaired" },
      { status: "paired", role: "parent", pairId: "p-1" },
    ]);
  });

  test("1 本だけの load の失敗は、起動画面のエラーにする", async () => {
    const { pairs, applied, loader } = setup("parent");
    const p = loader.load();
    await flush();
    pairs[0].reject(new Error("pairs: offline"));
    await p;
    assert.deepEqual(applied, [{ status: "loading", error: LOAD_ERROR }]);
  });
});

describe("sessionLoader: 待つ間の読み直し", () => {
  // 読み直しは数秒おきに走るので、毎回のサインイン（実機では保存域を読んで復号し、印を書く）と
  // 変わらない役割の読み直しをしない。ペアだけを読み、つながったときだけ全部を読み直す。
  test("まだつながっていなければ、getPair だけを呼び、画面は変えない", async () => {
    const { pairs, calls, applied, loader } = setup("child");
    const p = loader.refreshQuietly();
    await flush();
    pairs[0].resolve({ pairId: "p-1", role: "child", status: "pending" });
    await p;
    assert.deepEqual(calls, {
      signIn: 0,
      getRole: 0,
      getPair: 1,
      createPair: 0,
    });
    assert.deepEqual(applied, []);
  });

  test("つながっていたら、全部を読み直して受信一覧の状態にする", async () => {
    const { pairs, calls, applied, loader } = setup("child");
    const p = loader.refreshQuietly();
    await flush();
    pairs[0].resolve({ pairId: "p-1", role: "child", status: "active" });
    await flush();
    pairs[1].resolve({ pairId: "p-1", role: "child", status: "active" });
    await p;
    assert.equal(calls.signIn, 1);
    assert.deepEqual(applied, [
      { status: "paired", role: "child", pairId: "p-1" },
    ]);
  });

  test("つながった後の読み直しが失敗しても、画面に上げない", async () => {
    const { pairs, applied, loader } = setup("child");
    const p = loader.refreshQuietly();
    await flush();
    pairs[0].resolve({ pairId: "p-1", role: "child", status: "active" });
    await flush();
    pairs[1].reject(new Error("pairs: offline"));
    await p;
    assert.deepEqual(applied, []);
  });

  test("読み直しの失敗は画面に上げない", async () => {
    const { pairs, applied, loader } = setup("child");
    const p = loader.refreshQuietly();
    await flush();
    pairs[0].reject(new Error("pairs: offline"));
    await p;
    assert.deepEqual(applied, []);
  });
});

describe("sessionLoader: 番号の引き換えのあと", () => {
  // 子が番号を出し、親が「親のスマホ」を選んで番号の画面にいるところまで（偽バックエンド・メモリ）。
  async function pairing() {
    const hub = createMemoryHub();
    let n = 0;
    const newId = () =>
      `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    const device = () => new FakeBackend({ storage: hub.device(), newId });
    const child = device();
    await child.signIn();
    await child.setRole("child");
    await child.createPair();
    const { code } = await child.createInvite();
    const parent = device();
    await parent.signIn();
    await parent.setRole("parent");
    const applied = [];
    const loader = createSessionLoader({
      backend: () => parent,
      apply: (s) => applied.push(s),
    });
    await loader.load();
    assert.deepEqual(applied, [{ status: "parent_unpaired" }]);
    applied.length = 0;
    return { device, parent, code, applied, loader };
  }
  const HOME = { status: "paired", role: "parent" };
  const statuses = (applied) =>
    applied.map((s) => ({ status: s.status, role: s.role }));

  test("つながったら、読み直して親のホームの状態にする", async () => {
    const { code, applied, loader } = await pairing();
    const r = await loader.redeem(code);
    assert.equal(r.reason, "ok");
    assert.deepEqual(statuses(applied), [HOME]);
  });

  test("引き換えは済んだのに応答が失われた（送れなかった）ときも、読み直してホームへ進む", async () => {
    const { parent, code, applied, loader } = await pairing();
    const real = parent.redeemInvite.bind(parent);
    parent.redeemInvite = async (c) => {
      await real(c);
      throw new Error("redeem_invite: 応答が届かない");
    };
    await assert.rejects(loader.redeem(code));
    await flush();
    await flush();
    assert.deepEqual(statuses(applied), [HOME]);
  });

  test("押し直して used が返っても、自分のペアがつながっていればホームへ進む", async () => {
    const { parent, code, applied, loader } = await pairing();
    await parent.redeemInvite(code);
    const r = await loader.redeem(code);
    assert.equal(r.reason, "used");
    await flush();
    await flush();
    assert.deepEqual(statuses(applied), [HOME]);
  });

  test("already_paired が返っても、自分のペアがつながっていればホームへ進む", async () => {
    const { device, parent, code, applied, loader } = await pairing();
    await parent.redeemInvite(code);
    // 別の子の番号（親はもうつながっているので already_paired になる）。
    const other = device();
    await other.signIn();
    await other.setRole("child");
    await other.createPair();
    const next = await other.createInvite();
    const r = await loader.redeem(next.code);
    assert.equal(r.reason, "already_paired");
    await flush();
    await flush();
    assert.deepEqual(statuses(applied), [HOME]);
  });

  test("ちがう番号（invalid）なら読み直さず、番号の画面のまま", async () => {
    const { code, applied, loader } = await pairing();
    const wrong = code === "000000" ? "000001" : "000000";
    const r = await loader.redeem(wrong);
    assert.equal(r.reason, "invalid");
    await flush();
    await flush();
    assert.deepEqual(applied, []);
  });
});
