// 通知の Edge Function の入口の組み立て（Request → handleWebhook、DB の client → NotifyDeps）。
// Deno に依存しない。環境変数・client の作り方・fetch は引数で受ける（Deno の入口 index.ts が渡す）。
// テストは tests/notify.test.mjs（呼び出しを記録する偽の client と new Request() で、
// 有効なトークンだけを引くこと・秘密が違えば DB にも Expo にも触れないことを確かめる）。

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  handleWebhook,
  isAuthorized,
  SECRET_HEADER,
  type FetchLike,
  type NotifyDeps,
  type PairParties,
  type PushLogRow,
} from "./core.ts";

// 入口が読む環境変数の名前。
export const ENV_WEBHOOK_SECRET = "NOTIFY_WEBHOOK_SECRET";
export const ENV_EXPO_ACCESS_TOKEN = "EXPO_ACCESS_TOKEN";
export const ENV_SUPABASE_URL = "SUPABASE_URL";
export const ENV_SERVICE_ROLE_KEY = "SUPABASE_SERVICE_ROLE_KEY";

export interface EntryDeps {
  env: (name: string) => string | undefined;
  // service role の client を作る（RLS を通らない。セッションは持たない）。
  createClient: (url: string, key: string) => SupabaseClient;
  fetch: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

// DB の client から、core が使う出入りを作る。
export function makeDeps(
  client: SupabaseClient,
  io: {
    fetch: FetchLike;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    expoAccessToken?: string;
  },
): NotifyDeps {
  return {
    fetch: io.fetch,
    now: io.now ?? Date.now,
    sleep:
      io.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
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
    // 無効にしたトークン（disabled_at が埋まっている）は引かない。
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
    expoAccessToken: io.expoAccessToken,
  };
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Deno.serve に渡す処理。秘密を確かめてから本文を読み、client を作る（違えば DB にも Expo にも触れない）。
export async function handleRequest(
  req: Request,
  deps: EntryDeps,
): Promise<Response> {
  const secretHeader = req.headers.get(SECRET_HEADER);
  const secret = deps.env(ENV_WEBHOOK_SECRET);
  if (!isAuthorized(secretHeader, secret))
    return json(401, { error: "unauthorized" });
  const result = await handleWebhook(
    { secretHeader, secret, bodyText: await req.text() },
    () => {
      const url = deps.env(ENV_SUPABASE_URL);
      const key = deps.env(ENV_SERVICE_ROLE_KEY);
      if (!url || !key)
        throw new Error(
          `${ENV_SUPABASE_URL} か ${ENV_SERVICE_ROLE_KEY} がありません`,
        );
      return makeDeps(deps.createClient(url, key), {
        fetch: deps.fetch,
        now: deps.now,
        sleep: deps.sleep,
        expoAccessToken: deps.env(ENV_EXPO_ACCESS_TOKEN) || undefined,
      });
    },
  );
  return json(result.status, result.body);
}
