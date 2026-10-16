// 通知の Edge Function の Deno の入口。中身は core.ts（Deno に依存しない。tests/notify.test.mjs で検査する）。
// ここは環境変数を読み、service role の client と fetch を core に渡すだけ。
// 環境変数:
//   NOTIFY_WEBHOOK_SECRET … Database Webhook のヘッダ x-notify-secret と同じ値（違えば 401）
//   EXPO_ACCESS_TOKEN     … あれば Expo への送信に Authorization: Bearer で付ける（任意）
//   SUPABASE_URL・SUPABASE_SERVICE_ROLE_KEY … Edge Function に既定で入る
// "@supabase/supabase-js" は同じフォルダの deno.json で npm: の版に読み替える（tsc は node_modules の型で検査する）。

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  handleWebhook,
  SECRET_HEADER,
  type NotifyDeps,
  type PairParties,
  type PushLogRow,
} from "./core.ts";

// Deno の型を repo に入れないので、使う分だけをここで宣言する（Deno では実物の Deno が入る）。
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

function makeDeps(client: SupabaseClient): NotifyDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    now: Date.now,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    async getPairParties(pairId): Promise<PairParties | null> {
      const { data, error } = await client
        .from("pairs")
        .select("parent_id, child_id")
        .eq("id", pairId)
        .maybeSingle();
      if (error) fail("pairs", error);
      const row: unknown = data;
      if (!isRecord(row) || typeof row.child_id !== "string") return null;
      const parentId = typeof row.parent_id === "string" ? row.parent_id : null;
      return { parentId, childId: row.child_id };
    },
    async listActiveTokens(userId): Promise<string[]> {
      const { data, error } = await client
        .from("push_tokens")
        .select("token")
        .eq("user_id", userId)
        .is("disabled_at", null);
      if (error) fail("push_tokens", error);
      const rows: unknown = data;
      if (!Array.isArray(rows)) return [];
      return rows
        .map((r: unknown) => (isRecord(r) ? r.token : null))
        .filter((t): t is string => typeof t === "string");
    },
    async disableTokens(tokens, disabledAt): Promise<void> {
      const { error } = await client
        .from("push_tokens")
        .update({ disabled_at: disabledAt })
        .in("token", tokens);
      if (error) fail("push_tokens", error);
    },
    async writePushLog(rows: PushLogRow[]): Promise<void> {
      const { error } = await client.from("push_log").insert(rows);
      if (error) fail("push_log", error);
    },
    expoAccessToken: Deno.env.get("EXPO_ACCESS_TOKEN") || undefined,
  };
}

Deno.serve(async (req) => {
  const result = await handleWebhook(
    {
      secretHeader: req.headers.get(SECRET_HEADER),
      secret: Deno.env.get("NOTIFY_WEBHOOK_SECRET"),
      bodyText: await req.text(),
    },
    () => {
      const url = Deno.env.get("SUPABASE_URL");
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key)
        throw new Error(
          "SUPABASE_URL か SUPABASE_SERVICE_ROLE_KEY がありません",
        );
      // service role は RLS を通らない（push_log・他人の push_tokens を読み書きするため）。セッションは持たない。
      const client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return makeDeps(client);
    },
  );
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
});
