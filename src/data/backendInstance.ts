// アプリが使うバックエンドを 1 つ選ぶ（選び方は chooseBackend.ts）。
// EXPO_PUBLIC_SUPABASE_URL と EXPO_PUBLIC_SUPABASE_ANON_KEY が両方あれば Supabase。
// 端末内の偽バックエンド（Web は localStorage で 2 タブの親子を試せる。iOS / Android はメモリ）は、
// 開発中に設定が無いときか、EXPO_PUBLIC_BACKEND=fake を明示したときだけ使う。
// 本番の書き出しで設定が欠けていれば backend は null で、起動画面に「設定がありません」を出す（session.tsx）。
// 環境変数は process.env.EXPO_PUBLIC_* と書いたときだけ、書き出しの時に値へ置き換わる。

import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

import type { Backend } from "./backend";
import { chooseBackend } from "./chooseBackend";
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
const explicit = process.env.EXPO_PUBLIC_BACKEND;

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

function createBackend(): Backend | null {
  const kind = chooseBackend({ url, anonKey, dev: __DEV__, explicit });
  if (kind === "supabase" && url && anonKey) {
    return new SupabaseBackend(getSupabaseClient(url, anonKey), signInMark);
  }
  if (kind === "fake") {
    console.warn(
      "端末内の偽バックエンドで動きます（Supabase の設定が無い開発中か、EXPO_PUBLIC_BACKEND=fake。README の「Supabase の準備」）。",
    );
    return new FakeBackend({ storage: fakeStorage(), newId: randomUUID });
  }
  return null;
}

// モジュールを読んだときに 1 回だけ選ぶ（警告も 1 回だけ）。null は本番で設定が欠けているとき。
export const backend: Backend | null = createBackend();

// backend が要る処理から呼ぶ（設定が無いときは起動画面で止まるので、ここまで来ない）。
export function requireBackend(): Backend {
  if (!backend) throw new Error("バックエンドの設定がありません");
  return backend;
}
