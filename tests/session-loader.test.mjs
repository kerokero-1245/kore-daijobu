// サインインとペアの状態を読む createSessionLoader（src/data/sessionLoader.ts）を固定するテスト。
// 守るもの:
//   - 重なった読み込み（起動時・役割を選んだとき・番号を引き換えたとき・待つ間の読み直し）は、
//     後から始めた読み込みの結果がもう入っていたら、先に始めた方の結果も失敗も画面に入れない
//     （受信一覧 → 番号の画面 → 受信一覧と揺れない。成功の後に古い失敗が着いてエラー画面にならない）
//   - 待つ間の読み直しの失敗は画面に上げない
// バックエンドは手で応答を返せる偽物（呼ばれた順に応答を決める）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { createSessionLoader, LOAD_ERROR } =
  await import("../src/data/sessionLoader.ts");

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
  test("読み直しの失敗は画面に上げない", async () => {
    const { pairs, applied, loader } = setup("child");
    const p = loader.refreshQuietly();
    await flush();
    pairs[0].reject(new Error("pairs: offline"));
    await p;
    assert.deepEqual(applied, []);
  });
});
