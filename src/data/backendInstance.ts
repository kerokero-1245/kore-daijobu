// アプリが使うバックエンドを 1 つ選ぶ。
// EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY が両方あれば Supabase、
// 無ければ端末内の偽バックエンド（Web は localStorage で 2 タブの親子を試せる。iOS / Android はメモリ）。
// 環境変数は process.env.EXPO_PUBLIC_* と書いたときだけ、書き出しの時に値へ置き換わる。

import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

import type { Backend } from "./backend";
import {
  createMemoryHub,
  createWebFakeStorage,
  FakeBackend,
  type FakeStorage,
} from "./fakeBackend";
import { getSupabaseClient } from "./supabase";
import { SupabaseBackend, type SignInMark } from "./supabaseBackend";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// 一度サインインしたことがある印（端末に 1 つ置く）。保存したセッションが読めなくなったとき、
// 黙って新しい利用者を作らずにエラーを出すために使う（supabaseBackend.ts の signIn）。
const SIGNED_IN_KEY = "kore-daijobu:signed-in";
const signInMark: SignInMark = {
  has: async () => (await AsyncStorage.getItem(SIGNED_IN_KEY)) !== null,
  set: () => AsyncStorage.setItem(SIGNED_IN_KEY, "1"),
  clear: () => AsyncStorage.removeItem(SIGNED_IN_KEY),
};

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
    return new SupabaseBackend(getSupabaseClient(url, anonKey), signInMark);
  }
  console.warn(
    "EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が無いので、端末内の偽バックエンドで動きます（README の「Supabase の準備」）。",
  );
  return new FakeBackend({ storage: fakeStorage(), newId: randomUUID });
}

// モジュールを読んだときに 1 回だけ選ぶ（警告も 1 回だけ）。
export const backend: Backend = chooseBackend();
