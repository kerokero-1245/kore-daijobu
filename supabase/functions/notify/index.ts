// 通知の Edge Function の Deno の入口。環境変数と Deno.serve をつなぐだけ。
// 組み立て（Request → 秘密の確認 → client → 送信）は entry.ts、送る中身は core.ts（どちらも Deno に依存しない。
// tests/notify.test.mjs で検査する）。
// 環境変数（名前は entry.ts）:
//   NOTIFY_WEBHOOK_SECRET … Database Webhook のヘッダ x-notify-secret と同じ値（違えば 401）
//   EXPO_ACCESS_TOKEN     … あれば Expo への送信に Authorization: Bearer で付ける（MVP では任意）
//   SUPABASE_URL・SUPABASE_SERVICE_ROLE_KEY … Edge Function に既定で入る
// "@supabase/supabase-js" は同じフォルダの deno.json で npm: の版に読み替える（tsc は node_modules の型で検査する）。

import { createClient } from "@supabase/supabase-js";

import { handleRequest } from "./entry.ts";

// Deno の型を repo に入れないので、使う分だけをここで宣言する（Deno では実物の Deno が入る）。
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): unknown;
};

Deno.serve((req) =>
  handleRequest(req, {
    env: (name) => Deno.env.get(name),
    // service role は RLS を通らない（push_log・他人の push_tokens を読み書きするため）。セッションは持たない。
    createClient: (url, key) =>
      createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    fetch: (url, init) => fetch(url, init),
  }),
);
