// どのバックエンドで動くか（src/data/chooseBackend.ts）を固定するテスト。
// 守るもの: 本番の書き出し（dev でない）で設定が欠けたまま偽物に切り替わらないこと。
//   偽物は「開発中で設定が無い」か「EXPO_PUBLIC_BACKEND=fake を明示」のときだけ。
//   それ以外で URL か anon key が欠けていれば missing（起動画面に設定が無いと出す）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { describe, test } from "node:test";

const { chooseBackend } = await import("../src/data/chooseBackend.ts");

const URL = "https://example.supabase.co";
const KEY = "anon";

describe("chooseBackend: 本番で設定が欠けたら偽物に切り替えない", () => {
  test("URL と anon key がそろえば、開発中でも本番でも Supabase", () => {
    assert.equal(
      chooseBackend({ url: URL, anonKey: KEY, dev: true }),
      "supabase",
    );
    assert.equal(
      chooseBackend({ url: URL, anonKey: KEY, dev: false }),
      "supabase",
    );
  });

  test("開発中で設定が無ければ偽物", () => {
    assert.equal(chooseBackend({ dev: true }), "fake");
    assert.equal(chooseBackend({ url: URL, dev: true }), "fake");
  });

  test("本番で URL か anon key が欠けていれば missing（空文字も欠けとみなす）", () => {
    assert.equal(chooseBackend({ dev: false }), "missing");
    assert.equal(chooseBackend({ url: URL, dev: false }), "missing");
    assert.equal(chooseBackend({ anonKey: KEY, dev: false }), "missing");
    assert.equal(
      chooseBackend({ url: "", anonKey: "", dev: false }),
      "missing",
    );
  });

  test("EXPO_PUBLIC_BACKEND=fake を明示したときだけ、本番でも偽物", () => {
    assert.equal(chooseBackend({ dev: false, explicit: "fake" }), "fake");
    assert.equal(
      chooseBackend({ url: URL, anonKey: KEY, dev: false, explicit: "fake" }),
      "fake",
    );
    assert.equal(
      chooseBackend({ dev: false, explicit: "supabase" }),
      "missing",
    );
  });
});
