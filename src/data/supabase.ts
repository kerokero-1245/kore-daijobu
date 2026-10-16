// supabase-js の client を 1 回だけ作る。URL と公開鍵（anon key）は環境変数から（backendInstance.ts）。
// セッションは端末に保存して自動で更新する。URL からのセッションの読み取りはしない（アプリなので）。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import { authStorage } from "./authStorage";

let client: SupabaseClient | null = null;

export function getSupabaseClient(
  url: string,
  anonKey: string,
): SupabaseClient {
  if (client) return client;
  const created = createClient(url, anonKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // アプリが前面にいる間だけトークンの自動更新を回す（Web はブラウザが面倒を見るので付けない）。
  if (Platform.OS !== "web") {
    AppState.addEventListener("change", (state) => {
      if (state === "active") void created.auth.startAutoRefresh();
      else void created.auth.stopAutoRefresh();
    });
  }
  client = created;
  return created;
}
