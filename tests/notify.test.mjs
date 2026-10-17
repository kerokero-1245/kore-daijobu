// 通知（supabase/functions/notify/core.ts と src/domain/push.ts）を固定するテスト。
// 守るもの:
//   - 宛先: 相談の INSERT は子へ、返信で waiting → answered になった UPDATE は親へ（pairs の行から決める）。
//     答えを開いた印の UPDATE（answered → answered）では送らない
//   - 送るのは相手の有効なトークン（disabled_at が null）だけ。ticket を push_log に 1 件ずつ残す
//   - 失敗: 通信失敗・429・5xx は間を広げて 3 回まで再試行、400 は再試行しない、
//     DeviceNotRegistered はそのトークンの disabled_at を埋め、次からは送らない
//   - 入口: 秘密のヘッダが違えば 401 で、DB にも Expo にも触れない。入口の組み立て（entry.ts）は
//     有効なトークン（disabled_at が null）だけを引く（偽の client と new Request() で確かめる）
//   - アプリ側: トークンを取るのは開発ビルドの実機だけ / 通知を押したら役割ごとの画面 / トークンの保存
// fetch・時計・待ち・DB は差し替える（本物の Supabase・Expo には接続しない）。
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const {
  BASE_DELAY_MS,
  EXPO_PUSH_URL,
  MAX_RETRIES,
  handleWebhook,
  isAuthorized,
  notify,
} = await import("../supabase/functions/notify/core.ts");
const { handleRequest } = await import("../supabase/functions/notify/entry.ts");
const {
  PUSH_DATA_KEY,
  canRegisterPush,
  consultationIdFromData,
  routeForNotification,
} = await import("../src/domain/push.ts");
const { CATEGORY_META } = await import("../src/domain/category.ts");
const { FakeBackend, createMemoryHub } =
  await import("../src/data/fakeBackend.ts");
const { SupabaseBackend } = await import("../src/data/supabaseBackend.ts");

const PARENT = "00000000-0000-4000-8000-0000000000a1";
const CHILD = "00000000-0000-4000-8000-0000000000c1";
const PAIR = "40000000-0000-4000-8000-000000000001";
const CID = "50000000-0000-4000-8000-000000000001";
const NOW = Date.parse("2026-10-17T00:00:00Z");

// ---- 差し替えの道具 ----

// DB の代わり（pairs と push_tokens と push_log）。
function fakeDb(tokens) {
  const db = {
    pairs: new Map([[PAIR, { parentId: PARENT, childId: CHILD }]]),
    tokens: tokens.map((t) => ({ disabled_at: null, ...t })),
    log: [],
  };
  return db;
}

// Expo の代わり。responder(messages, callIndex) が { status, body } か例外を返す。
function fakeExpo(responder) {
  const calls = [];
  const fetch = async (url, init) => {
    const messages = JSON.parse(init.body);
    calls.push({ url, init, messages });
    const r = await responder(messages, calls.length - 1);
    return { status: r.status, json: async () => r.body };
  };
  return { calls, fetch };
}

const okTickets = (messages) => ({
  status: 200,
  body: { data: messages.map((_, i) => ({ status: "ok", id: `ticket-${i}` })) },
});

function deps(db, expo, extra = {}) {
  const sleeps = [];
  return {
    sleeps,
    deps: {
      fetch: expo.fetch,
      now: () => NOW,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      getPairParties: async (pairId) => db.pairs.get(pairId) ?? null,
      listActiveTokens: async (uid) =>
        db.tokens
          .filter((t) => t.user_id === uid && t.disabled_at === null)
          .map((t) => t.token),
      disableTokens: async (list, at) => {
        for (const t of db.tokens)
          if (list.includes(t.token)) t.disabled_at = at;
      },
      writePushLog: async (rows) => {
        db.log.push(...rows);
      },
      ...extra,
    },
  };
}

const insertPayload = (category = "money") => ({
  type: "INSERT",
  table: "consultations",
  schema: "public",
  record: { id: CID, pair_id: PAIR, category, status: "waiting" },
  old_record: null,
});
const answeredPayload = (oldStatus = "waiting") => ({
  type: "UPDATE",
  table: "consultations",
  schema: "public",
  record: { id: CID, pair_id: PAIR, category: "money", status: "answered" },
  old_record: { id: CID, pair_id: PAIR, category: "money", status: oldStatus },
});

const TOKENS = [
  { token: "ExponentPushToken[child-1]", user_id: CHILD },
  { token: "ExponentPushToken[child-2]", user_id: CHILD },
  { token: "ExponentPushToken[parent-1]", user_id: PARENT },
];

// ---- 宛先と本文 ----

describe("notify: 宛先と本文", () => {
  test("相談の INSERT は子のトークン 2 本に送り、push_log に 2 件残す", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    const r = await notify(d, insertPayload("refund"));
    assert.equal(expo.calls.length, 1);
    assert.equal(expo.calls[0].url, EXPO_PUSH_URL);
    assert.equal(expo.calls[0].url, "https://exp.host/--/api/v2/push/send");
    assert.deepEqual(
      expo.calls[0].messages.map((m) => m.to),
      ["ExponentPushToken[child-1]", "ExponentPushToken[child-2]"],
    );
    for (const m of expo.calls[0].messages) {
      assert.equal(m.body, `親から相談：${CATEGORY_META.refund.label}`);
      assert.deepEqual(m.data, { [PUSH_DATA_KEY]: CID });
    }
    assert.equal(db.log.length, 2);
    assert.deepEqual(
      db.log.map((l) => [l.event, l.ticket_id, l.status, l.error]),
      [
        [`consultation_created:${CID}`, "ticket-0", "ok", null],
        [`consultation_created:${CID}`, "ticket-1", "ok", null],
      ],
    );
    assert.equal(r.sent, 2);
  });

  test("返信で waiting → answered になったら親に送る", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    await notify(d, answeredPayload());
    assert.equal(expo.calls.length, 1);
    assert.deepEqual(
      expo.calls[0].messages.map((m) => m.to),
      ["ExponentPushToken[parent-1]"],
    );
    assert.equal(expo.calls[0].messages[0].body, "返事が届きました");
    assert.deepEqual(
      db.log.map((l) => l.event),
      [`reply_arrived:${CID}`],
    );
  });

  test("答えを開いた印の UPDATE（answered → answered）・他の表・DELETE では送らない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    for (const p of [
      answeredPayload("answered"),
      { ...insertPayload(), table: "replies" },
      { ...insertPayload(), type: "DELETE" },
      { ...answeredPayload(), old_record: null },
      null,
      "x",
    ]) {
      const r = await notify(d, p);
      assert.equal(r.skipped, "ignored");
    }
    assert.equal(expo.calls.length, 0);
    assert.equal(db.log.length, 0);
  });

  test("知らないカテゴリは「その他」で送る。本文に断定の語を使わない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    await notify(d, insertPayload("unknown"));
    await notify(d, answeredPayload());
    const bodies = expo.calls.flatMap((c) => c.messages.map((m) => m.body));
    assert.ok(bodies.includes(`親から相談：${CATEGORY_META.other.label}`));
    assert.ok(bodies.length > 0, "0 件なら検査になっていない");
    for (const b of bodies)
      for (const w of ["詐欺", "危険", "安全", "大丈夫です", "緊急"])
        assert.ok(!b.includes(w), `${b} に ${w}`);
  });

  test("無効なトークンだけの相手には送らない（push_log も残さない）", async () => {
    const db = fakeDb([
      { token: "ExponentPushToken[child-1]", user_id: CHILD, disabled_at: "x" },
    ]);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    const r = await notify(d, insertPayload());
    assert.equal(r.skipped, "no_tokens");
    assert.equal(expo.calls.length, 0);
    assert.equal(db.log.length, 0);
  });

  test("ペアが無い・親がまだいないときは送らない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    db.pairs.clear();
    assert.equal((await notify(d, insertPayload())).skipped, "no_pair");
    db.pairs.set(PAIR, { parentId: null, childId: CHILD });
    assert.equal((await notify(d, answeredPayload())).skipped, "no_recipient");
    assert.equal(expo.calls.length, 0);
  });

  test("EXPO_ACCESS_TOKEN があれば Authorization: Bearer を付け、無ければ付けない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    await notify(
      deps(db, expo, { expoAccessToken: "secret-token" }).deps,
      insertPayload(),
    );
    await notify(deps(db, expo).deps, insertPayload());
    assert.equal(
      expo.calls[0].init.headers.authorization,
      "Bearer secret-token",
    );
    assert.equal(expo.calls[1].init.headers.authorization, undefined);
  });
});

// ---- 失敗の扱い ----

describe("notify: 再試行と無効化", () => {
  test("429 が続けば、間を広げて 3 回再試行して諦め、push_log に失敗を残す", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(() => ({
      status: 429,
      body: { errors: [{ code: "TOO_MANY_REQUESTS" }] },
    }));
    const { deps: d, sleeps } = deps(db, expo);
    const r = await notify(d, insertPayload());
    assert.equal(MAX_RETRIES, 3);
    assert.equal(expo.calls.length, 1 + 3);
    assert.deepEqual(sleeps, [
      BASE_DELAY_MS,
      BASE_DELAY_MS * 2,
      BASE_DELAY_MS * 4,
    ]);
    assert.equal(db.log.length, 2);
    for (const l of db.log) {
      assert.equal(l.status, "error");
      assert.equal(l.error, "HTTP 429 TOO_MANY_REQUESTS");
    }
    assert.equal(r.sent, 0);
    assert.equal(r.failed, 2);
  });

  test("通信失敗と 5xx は再試行し、途中で通れば ticket を残す", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo((messages, i) => {
      if (i === 0) throw new Error("socket hang up");
      if (i === 1) return { status: 503, body: {} };
      return okTickets(messages);
    });
    const { deps: d, sleeps } = deps(db, expo);
    const r = await notify(d, insertPayload());
    assert.equal(expo.calls.length, 3);
    assert.equal(sleeps.length, 2);
    assert.equal(r.sent, 2);
    assert.deepEqual(
      db.log.map((l) => l.status),
      ["ok", "ok"],
    );
  });

  test("400 は再試行しない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(() => ({
      status: 400,
      body: { errors: [{ code: "VALIDATION_ERROR" }] },
    }));
    const { deps: d, sleeps } = deps(db, expo);
    await notify(d, insertPayload());
    assert.equal(expo.calls.length, 1);
    assert.deepEqual(sleeps, []);
    assert.deepEqual(
      db.log.map((l) => l.error),
      ["HTTP 400 VALIDATION_ERROR", "HTTP 400 VALIDATION_ERROR"],
    );
  });

  test("DeviceNotRegistered のトークンは disabled_at が埋まり、次からは送らない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo((messages) => ({
      status: 200,
      body: {
        data: messages.map((m, i) =>
          m.to === "ExponentPushToken[child-1]"
            ? {
                status: "error",
                message: "not a registered push notification recipient",
                details: { error: "DeviceNotRegistered" },
              }
            : { status: "ok", id: `ticket-${i}` },
        ),
      },
    }));
    const { deps: d } = deps(db, expo);
    const r1 = await notify(d, insertPayload());
    assert.equal(r1.disabled, 1);
    const dead = db.tokens.find(
      (t) => t.token === "ExponentPushToken[child-1]",
    );
    const alive = db.tokens.find(
      (t) => t.token === "ExponentPushToken[child-2]",
    );
    assert.equal(dead.disabled_at, new Date(NOW).toISOString());
    assert.equal(alive.disabled_at, null);
    assert.deepEqual(
      db.log.map((l) => [l.status, l.error]),
      [
        ["error", "DeviceNotRegistered"],
        ["ok", null],
      ],
    );
    await notify(d, insertPayload());
    assert.deepEqual(
      expo.calls[1].messages.map((m) => m.to),
      ["ExponentPushToken[child-2]"],
    );
  });

  test("DeviceNotRegistered 以外の ticket の失敗ではトークンを無効にしない", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo((messages) => ({
      status: 200,
      body: {
        data: messages.map(() => ({
          status: "error",
          message: "rate",
          details: { error: "MessageRateExceeded" },
        })),
      },
    }));
    const { deps: d } = deps(db, expo);
    const r = await notify(d, insertPayload());
    assert.equal(r.disabled, 0);
    assert.ok(db.tokens.every((t) => t.disabled_at === null));
  });
});

// ---- 入口 ----

describe("notify: 秘密のヘッダ", () => {
  const body = JSON.stringify(insertPayload());

  test("秘密のヘッダが違う・無い・環境変数が未設定なら 401 で、deps を作らない", async () => {
    let made = 0;
    const makeDeps = () => {
      made++;
      throw new Error("作られてはいけない");
    };
    for (const [header, secret] of [
      ["wrong-secret", "right-secret"],
      [null, "right-secret"],
      ["right-secret", undefined],
      ["", ""],
      ["right-secreT", "right-secret"],
      // 秘密を先頭に含む長いヘッダ・秘密の途中までのヘッダ（長さの比較を外すと通ってしまう組）。
      ["right-secret-extra", "right-secret"],
      ["right-secre", "right-secret"],
    ]) {
      const r = await handleWebhook(
        { secretHeader: header, secret, bodyText: body },
        makeDeps,
      );
      assert.equal(r.status, 401);
    }
    assert.equal(made, 0);
  });

  test("秘密が合えば送って 200、本文が JSON でなければ 400", async () => {
    const db = fakeDb(TOKENS);
    const expo = fakeExpo(okTickets);
    const { deps: d } = deps(db, expo);
    const ok = await handleWebhook(
      { secretHeader: "s3cret", secret: "s3cret", bodyText: body },
      () => d,
    );
    assert.equal(ok.status, 200);
    assert.equal(ok.body.sent, 2);
    const bad = await handleWebhook(
      { secretHeader: "s3cret", secret: "s3cret", bodyText: "{" },
      () => d,
    );
    assert.equal(bad.status, 400);
    assert.equal(isAuthorized("a", "a"), true);
    assert.equal(isAuthorized("a", "b"), false);
  });

  test("DB の失敗は 500 で返す", async () => {
    const db = fakeDb(TOKENS);
    const { deps: d } = deps(db, fakeExpo(okTickets), {
      getPairParties: async () => {
        throw new Error("pairs: boom");
      },
    });
    const r = await handleWebhook(
      { secretHeader: "s", secret: "s", bodyText: body },
      () => d,
    );
    assert.equal(r.status, 500);
  });

  test("Deno の入口（index.ts）は entry.ts の handleRequest を Deno.serve に渡し、環境変数は Deno.env から読む", () => {
    const src = readFileSync(
      new URL("../supabase/functions/notify/index.ts", import.meta.url),
      "utf8",
    );
    assert.ok(src.includes("Deno.serve("));
    assert.ok(src.includes("handleRequest(req,"));
    assert.ok(src.includes("env: (name) => Deno.env.get(name)"));
  });
});

// ---- 入口の組み立て（entry.ts）: 偽の client と new Request() ----

// supabase-js の呼び出しを表ごとに記録する偽の client（tests/backend.test.mjs と同じ作り）。
// responses[table] がその表への問い合わせの結果になる。
function recordingDbClient(responses = {}) {
  const calls = [];
  const from = (table) => {
    const rec = { table, ops: [] };
    calls.push(rec);
    const result = responses[table] ?? { data: null, error: null };
    const builder = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then")
            return (res, rej) => Promise.resolve(result).then(res, rej);
          return (...args) => {
            rec.ops.push([prop, ...args]);
            return builder;
          };
        },
      },
    );
    return builder;
  };
  return { calls, from };
}

describe("notify: 入口の組み立て（entry.ts）", () => {
  const ENV = {
    NOTIFY_WEBHOOK_SECRET: "right-secret",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-key",
    EXPO_ACCESS_TOKEN: "expo-token",
  };

  function setup({ env = ENV, tokens } = {}) {
    const client = recordingDbClient({
      pairs: { data: { parent_id: PARENT, child_id: CHILD }, error: null },
      push_tokens: {
        data: tokens ?? [
          { token: "ExponentPushToken[child-1]" },
          { token: "ExponentPushToken[child-2]" },
        ],
        error: null,
      },
    });
    const expo = fakeExpo(okTickets);
    const created = [];
    const deps = {
      env: (name) => env[name],
      createClient: (url, key) => {
        created.push([url, key]);
        return client;
      },
      fetch: expo.fetch,
      now: () => NOW,
      sleep: async () => {},
    };
    return { client, expo, created, deps };
  }

  const request = (headers, body = JSON.stringify(insertPayload())) =>
    new Request("https://example.supabase.co/functions/v1/notify", {
      method: "POST",
      headers,
      body,
    });

  test("有効なトークンだけを引く: push_tokens を token の列で、user_id と disabled_at is null で絞る", async () => {
    const { client, deps } = setup();
    const res = await handleRequest(
      request({ "x-notify-secret": "right-secret" }),
      deps,
    );
    assert.equal(res.status, 200);
    const q = client.calls.filter(
      (c) => c.table === "push_tokens" && c.ops[0]?.[0] === "select",
    );
    assert.equal(q.length, 1);
    assert.deepEqual(q[0].ops, [
      ["select", "token"],
      ["eq", "user_id", CHILD],
      ["is", "disabled_at", null],
    ]);
    const pair = client.calls.find((c) => c.table === "pairs");
    assert.deepEqual(pair.ops, [
      ["select", "parent_id, child_id"],
      ["eq", "id", PAIR],
      ["maybeSingle"],
    ]);
  });

  test("秘密が無い・違う・未設定なら 401 で、client を作らず DB にも Expo にも触れない", async () => {
    for (const [headers, env] of [
      [{}, ENV],
      [{ "x-notify-secret": "wrong-secret" }, ENV],
      [{ "x-notify-secret": "right-secret-extra" }, ENV],
      [
        { "x-notify-secret": "right-secret" },
        { ...ENV, NOTIFY_WEBHOOK_SECRET: undefined },
      ],
      // 秘密そのものを Webhook のヘッダの代わりに渡しても通らない（ヘッダは Request から読む）。
      [{ "x-other": "right-secret" }, ENV],
    ]) {
      const { client, expo, created, deps } = setup({ env });
      const res = await handleRequest(request(headers), deps);
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: "unauthorized" });
      assert.deepEqual(created, []);
      assert.deepEqual(client.calls, []);
      assert.equal(expo.calls.length, 0);
    }
  });

  test("正しい秘密なら送り、ticket を push_log に書く。EXPO_ACCESS_TOKEN は Bearer で付ける", async () => {
    const { client, expo, created, deps } = setup();
    const res = await handleRequest(
      request({
        "x-notify-secret": "right-secret",
        "content-type": "application/json",
      }),
      deps,
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/json");
    const body = await res.json();
    assert.equal(body.sent, 2);
    assert.deepEqual(created, [["https://example.supabase.co", "service-key"]]);
    assert.equal(expo.calls.length, 1);
    assert.equal(expo.calls[0].init.headers.authorization, "Bearer expo-token");
    assert.deepEqual(
      expo.calls[0].messages.map((m) => m.to),
      ["ExponentPushToken[child-1]", "ExponentPushToken[child-2]"],
    );
    const log = client.calls.find((c) => c.table === "push_log");
    assert.equal(log.ops[0][0], "insert");
    assert.deepEqual(
      log.ops[0][1].map((r) => r.ticket_id),
      ["ticket-0", "ticket-1"],
    );
  });

  test("DeviceNotRegistered のトークンは push_tokens の disabled_at を token で絞って埋める", async () => {
    const { client, deps } = setup();
    deps.fetch = fakeExpo((messages) => ({
      status: 200,
      body: {
        data: messages.map((m, i) =>
          i === 0
            ? { status: "error", details: { error: "DeviceNotRegistered" } }
            : { status: "ok", id: `ticket-${i}` },
        ),
      },
    })).fetch;
    await handleRequest(request({ "x-notify-secret": "right-secret" }), deps);
    const upd = client.calls.find(
      (c) => c.table === "push_tokens" && c.ops[0]?.[0] === "update",
    );
    assert.deepEqual(upd.ops, [
      ["update", { disabled_at: new Date(NOW).toISOString() }],
      ["in", "token", ["ExponentPushToken[child-1]"]],
    ]);
  });

  test("SUPABASE_URL か service role の鍵が無ければ 500（Expo には送らない）", async () => {
    const { expo, created, deps } = setup({
      env: { ...ENV, SUPABASE_SERVICE_ROLE_KEY: undefined },
    });
    const res = await handleRequest(
      request({ "x-notify-secret": "right-secret" }),
      deps,
    );
    assert.equal(res.status, 500);
    assert.deepEqual(created, []);
    assert.equal(expo.calls.length, 0);
  });
});

// ---- アプリ側 ----

describe("アプリ側: 環境の判定・開く画面・トークンの保存", () => {
  const device = {
    os: "ios",
    isDevice: true,
    appOwnership: null,
    executionEnvironment: "storeClient",
  };

  test("トークンを取るのは開発ビルド（と本番のビルド）の実機だけ", () => {
    assert.equal(canRegisterPush(device), true); // 開発ビルド
    assert.equal(
      canRegisterPush({ ...device, executionEnvironment: "standalone" }),
      true,
    );
    assert.equal(canRegisterPush({ ...device, os: "android" }), true);
    assert.equal(canRegisterPush({ ...device, appOwnership: "expo" }), false); // Expo Go
    assert.equal(canRegisterPush({ ...device, os: "web" }), false);
    assert.equal(canRegisterPush({ ...device, isDevice: false }), false); // シミュレータ
  });

  test("通知の data から相談の id を読み、親は答えの画面・子は詳細を開く", () => {
    assert.equal(consultationIdFromData({ [PUSH_DATA_KEY]: CID }), CID);
    assert.equal(consultationIdFromData({ [PUSH_DATA_KEY]: 1 }), null);
    assert.equal(consultationIdFromData(null), null);
    assert.equal(consultationIdFromData([CID]), null);
    assert.deepEqual(routeForNotification("parent", CID), {
      name: "ParentStatus",
      params: { consultationId: CID },
    });
    assert.deepEqual(routeForNotification("child", CID), {
      name: "ConsultationDetail",
      params: { consultationId: CID },
    });
  });

  test("FakeBackend はトークンを自分のものとしてメモリに置き、サインアウトで外す", async () => {
    const hub = createMemoryHub();
    let n = 0;
    const b = new FakeBackend({
      storage: hub.device(),
      newId: () => `id-${++n}`,
    });
    const uid = await b.signIn();
    await b.upsertPushToken("ExponentPushToken[a]");
    await b.upsertPushToken("ExponentPushToken[a]");
    assert.deepEqual([...b.pushTokens()], [["ExponentPushToken[a]", uid]]);
    await b.signOut();
    assert.equal(b.pushTokens().size, 0);
  });

  test("FakeBackend は前の利用者の行が残っていても持ち主を移す（本物の register_push_token と同じ）", async () => {
    const storage = createMemoryHub().device();
    let n = 0;
    const b = new FakeBackend({ storage, newId: () => `id-${++n}` });
    const first = await b.signIn();
    await b.upsertPushToken("ExponentPushToken[a]");
    // サインアウトの削除を通らずに利用者が替わった（保存したセッションが読めなかった）場合と同じ形。
    storage.writeSession(null);
    const second = await b.signIn();
    assert.notEqual(first, second);
    await b.upsertPushToken("ExponentPushToken[a]");
    assert.deepEqual([...b.pushTokens()], [["ExponentPushToken[a]", second]]);
  });

  test("SupabaseBackend は関数 register_push_token に { p_token } で登録する（表への upsert はしない）", async () => {
    const calls = [];
    const from = (table) => {
      const rec = { table, ops: [] };
      calls.push(rec);
      const builder = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then")
              return (res) => res({ data: null, error: null });
            return (...args) => {
              rec.ops.push([prop, ...args]);
              return builder;
            };
          },
        },
      );
      return builder;
    };
    const client = {
      from,
      async rpc(name, args) {
        calls.push({ rpc: name, args });
        return { data: null, error: null };
      },
      auth: {
        getSession: async () => ({
          data: { session: { user: { id: CHILD } } },
          error: null,
        }),
        signOut: async () => ({ error: null }),
      },
    };
    const b = new SupabaseBackend(client);
    await b.signIn();
    await b.upsertPushToken("ExponentPushToken[a]");
    assert.deepEqual(
      calls.filter((c) => c.rpc),
      [
        {
          rpc: "register_push_token",
          args: { p_token: "ExponentPushToken[a]" },
        },
      ],
    );
    assert.ok(
      !calls.some((c) => c.ops?.some(([op]) => op === "upsert")),
      "表への upsert はしない",
    );
    await b.signOut();
    const del = calls.find((c) => c.ops?.some(([op]) => op === "delete"));
    assert.equal(del.table, "push_tokens");
    assert.deepEqual(del.ops[1], ["eq", "user_id", CHILD]);
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20261016000000_init.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.ok(sql.includes("create table public.push_tokens ("));
    assert.ok(sql.includes("token text primary key"));
    const claim = readFileSync(
      new URL(
        "../supabase/migrations/20261017000000_push_token_claim.sql",
        import.meta.url,
      ),
      "utf8",
    );
    assert.ok(
      claim.includes(
        "create function public.register_push_token(p_token text)",
      ),
    );
  });

  test("SupabaseBackend はサインイン前の登録を投げて止める（関数を呼ばない）", async () => {
    const calls = [];
    const b = new SupabaseBackend({
      async rpc(name) {
        calls.push(name);
        return { data: null, error: null };
      },
    });
    await assert.rejects(b.upsertPushToken("ExponentPushToken[a]"));
    assert.deepEqual(calls, []);
  });
});
