// アプリが使うバックエンドを 1 つ選ぶ。
// EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY が両方あれば Supabase、
// 無ければ端末内の偽バックエンド（Web は localStorage で 2 タブの親子を試せる。iOS / Android はメモリ）。
// 環境変数は process.env.EXPO_PUBLIC_* と書いたときだけ、書き出しの時に値へ置き換わる。

import { randomUUID } from "expo-crypto";

import type { Backend } from "./backend";
import {
  createMemoryHub,
  createWebFakeStorage,
  FakeBackend,
  type FakeStorage,
} from "./fakeBackend";
import { getSupabaseClient } from "./supabase";
import { SupabaseBackend } from "./supabaseBackend";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function fakeStorage(): FakeStorage {
  if (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined" &&
    typeof window.sessionStorage !== "undefined" &&
    typeof window.addEventListener === "function"
  ) {
    return createWebFakeStorage(
      window.localStorage,
      window.sessionStorage,
      window,
    );
  }
  return createMemoryHub().device();
}

function chooseBackend(): Backend {
  if (url && anonKey) {
    return new SupabaseBackend(getSupabaseClient(url, anonKey));
  }
  console.warn(
    "EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が無いので、端末内の偽バックエンドで動きます（README の「Supabase の準備」）。",
  );
  return new FakeBackend({ storage: fakeStorage(), newId: randomUUID });
}

// モジュールを読んだときに 1 回だけ選ぶ（警告も 1 回だけ）。
export const backend: Backend = chooseBackend();
