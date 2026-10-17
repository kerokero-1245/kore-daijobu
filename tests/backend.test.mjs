// バックエンドの 2 つの実装を固定するテスト。
// 守るもの:
//   - FakeBackend の招待が DB（supabase/migrations/20261016000000_init.sql の create_invite / redeem_invite）と
//     同じ規則で動くこと: 6 桁・10 分・使い切り・新しい番号で古い番号は無効・失敗が 10 分で 5 回に達したら断る・
//     引き換えられるのは親の役割の人だけ・つながった親は 2 本目を結べない
//   - FakeBackend の書き込みの役割の検査（相談は親だけ・返信は子だけで 1 回・他人には 0 行）と、
//     返信で status が answered になること・別の端末の書き込みが購読に届くこと
//   - SupabaseBackend が呼ぶ表名・関数名・filter・チャンネル名（呼び出しを記録する偽の client で検査）と、
//     購読がつながったとき・変更の配信が始まったとき（system の status ok）に一覧を取り直す知らせを出すことと、
//     その表名・関数名が移行 SQL に実在し、購読する表が publication に入っていること
//   - ペアリングの純関数（起動時の状態・残り時間・失敗の文言）
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

const { FakeBackend, createMemoryHub } =
  await import("../src/data/fakeBackend.ts");
const { SupabaseBackend, CONSULTATION_COLUMNS } =
  await import("../src/data/supabaseBackend.ts");
const {
  formatRemaining,
  isInviteCode,
  redeemMessage,
  sessionStatusOf,
  toRedeemReason,
} = await import("../src/domain/pairing.ts");

const MIN = 60 * 1000;

// ---- FakeBackend の道具: 共有の場に端末を足し、時計を全端末で共有する ----
function world() {
  const hub = createMemoryHub();
  let n = 0;
  const clock = { t: Date.parse("2026-10-16T00:00:00Z") };
  const device = () =>
    new FakeBackend({
      storage: hub.device(),
      newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
      now: () => clock.t,
    });
  return { device, clock };
}

async function signedIn(w, role) {
  const b = w.device();
  await b.signIn();
  if (role) await b.setRole(role);
  if (role === "child") await b.createPair();
  return b;
}

async function paired() {
  const w = world();
  const child = await signedIn(w, "child");
  const parent = await signedIn(w, "parent");
  const { code } = await child.createInvite();
  const r = await parent.redeemInvite(code);
  assert.deepEqual(r, { ok: true, reason: "ok" });
  const { pairId } = await child.getPair();
  return { w, child, parent, pairId };
}

describe("FakeBackend: 招待の発行", () => {
  test("子が出す番号は数字 6 桁で、期限は発行から 10 分", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const inv = await child.createInvite();
    assert.ok(isInviteCode(inv.code), inv.code);
    assert.equal(inv.expiresAt, w.clock.t + 10 * MIN);
  });

  test("親や、ペアの無い人は番号を出せない（pending のペアが要る）", async () => {
    const w = world();
    const parent = await signedIn(w, "parent");
    await assert.rejects(parent.createInvite(), /no pending pair/);
    const nobody = await signedIn(w, null);
    await assert.rejects(nobody.createInvite(), /no pending pair/);
  });

  test("サインイン前は何もできない", async () => {
    const w = world();
    const b = w.device();
    await assert.rejects(b.getRole(), /not signed in/);
  });

  test("役割は 1 回だけ決まり、あとから変えられない", async () => {
    const w = world();
    const b = await signedIn(w, "parent");
    await assert.rejects(b.setRole("child"), /profile exists/);
    assert.equal(await b.getRole(), "parent");
  });
});

describe("FakeBackend: 招待の引き換え（規則 × 役割 × 期限）", () => {
  test("親が正しい番号を入れると、両方のペアが active になり役割が決まる", async () => {
    const { child, parent, pairId } = await paired();
    assert.deepEqual(await child.getPair(), {
      pairId,
      role: "child",
      status: "active",
    });
    assert.deepEqual(await parent.getPair(), {
      pairId,
      role: "parent",
      status: "active",
    });
  });

  test("ちがう番号は invalid", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const parent = await signedIn(w, "parent");
    const { code } = await child.createInvite();
    const wrong = code === "000000" ? "000001" : "000000";
    assert.deepEqual(await parent.redeemInvite(wrong), {
      ok: false,
      reason: "invalid",
    });
  });

  test("10 分ちょうどで期限切れ（expired）。1 ms 前なら通る", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const parent = await signedIn(w, "parent");
    const { code } = await child.createInvite();
    w.clock.t += 10 * MIN;
    assert.equal((await parent.redeemInvite(code)).reason, "expired");

    const { code: code2 } = await child.createInvite();
    w.clock.t += 10 * MIN - 1;
    assert.equal((await parent.redeemInvite(code2)).reason, "ok");
  });

  test("使い切り: 一度使った番号は、別の親が入れても used", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const p1 = await signedIn(w, "parent");
    const p2 = await signedIn(w, "parent");
    const { code } = await child.createInvite();
    assert.equal((await p1.redeemInvite(code)).reason, "ok");
    assert.equal((await p2.redeemInvite(code)).reason, "used");
  });

  test("新しい番号を出すと、古い未使用の番号は invalid になる", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const parent = await signedIn(w, "parent");
    const old = await child.createInvite();
    let fresh = await child.createInvite();
    // 乱数で同じ番号が出たら出し直す（古い番号は消えているので重なりうる）
    while (fresh.code === old.code) fresh = await child.createInvite();
    assert.equal((await parent.redeemInvite(old.code)).reason, "invalid");
    assert.equal((await parent.redeemInvite(fresh.code)).reason, "ok");
  });

  test("役割: 子や、役割を決めていない人は引き換えられない（not_parent）", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const other = await signedIn(w, "child");
    const nobody = await signedIn(w, null);
    const { code } = await child.createInvite();
    assert.equal((await other.redeemInvite(code)).reason, "not_parent");
    assert.equal((await nobody.redeemInvite(code)).reason, "not_parent");
    assert.equal((await child.redeemInvite(code)).reason, "not_parent");
  });

  test("つながった親は、別の子の番号で 2 本目を結べない（already_paired）", async () => {
    const { w, parent } = await paired();
    const child2 = await signedIn(w, "child");
    const { code } = await child2.createInvite();
    assert.equal((await parent.redeemInvite(code)).reason, "already_paired");
  });

  test("失敗が 10 分で 5 回に達すると、正しい番号でも断る。10 分たてば通る", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const parent = await signedIn(w, "parent");
    const { code } = await child.createInvite();
    const wrong = code === "000000" ? "000001" : "000000";
    for (let i = 0; i < 4; i++) {
      assert.equal((await parent.redeemInvite(wrong)).reason, "invalid");
    }
    // 5 回目の失敗
    assert.equal((await parent.redeemInvite(wrong)).reason, "invalid");
    assert.equal((await parent.redeemInvite(code)).reason, "too_many_attempts");
    // 断った試行も失敗として数える。最後の失敗から 10 分たつと窓から外れる
    w.clock.t += 9 * MIN;
    const { code: code2 } = await child.createInvite();
    w.clock.t += 1 * MIN + 1;
    assert.equal((await parent.redeemInvite(code2)).reason, "ok");
  });

  test("失敗 4 回までは、正しい番号で通る（5 回目から断る境目）", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const parent = await signedIn(w, "parent");
    const { code } = await child.createInvite();
    const wrong = code === "000000" ? "000001" : "000000";
    for (let i = 0; i < 4; i++) await parent.redeemInvite(wrong);
    assert.equal((await parent.redeemInvite(code)).reason, "ok");
  });

  test("失敗の回数は人ごと（別の親の失敗は数えない）", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const p1 = await signedIn(w, "parent");
    const p2 = await signedIn(w, "parent");
    const { code } = await child.createInvite();
    const wrong = code === "000000" ? "000001" : "000000";
    for (let i = 0; i < 5; i++) await p1.redeemInvite(wrong);
    assert.equal((await p2.redeemInvite(code)).reason, "ok");
  });
});

describe("FakeBackend: 相談と返信の役割", () => {
  const ID = "20000000-0000-4000-8000-000000000001";

  test("相談を作れるのは親だけ。子が作ろうとすると拒否", async () => {
    const { child, parent, pairId } = await paired();
    await assert.rejects(
      child.insertConsultation({ id: ID, pairId, category: "money" }),
      /row-level security/,
    );
    await parent.insertConsultation({ id: ID, pairId, category: "money" });
    const list = await child.listConsultations(pairId, 50);
    assert.deepEqual(
      list.map((c) => [c.id, c.status]),
      [[ID, "waiting"]],
    );
  });

  test("返信できるのは子だけで 1 回。返信で answered になり、親が開いた時刻を書ける", async () => {
    const { w, child, parent, pairId } = await paired();
    await parent.insertConsultation({ id: ID, pairId, category: "refund" });
    await assert.rejects(
      parent.insertReply(ID, "safe", "大丈夫"),
      /row-level security/,
    );
    w.clock.t += MIN;
    await child.insertReply(ID, "danger", "それ詐欺かも");
    await assert.rejects(
      child.insertReply(ID, "safe", "二回目"),
      /row-level security/,
    );
    const c = await parent.getConsultation(ID);
    assert.equal(c.status, "answered");
    assert.deepEqual(c.reply, {
      verdict: "danger",
      message: "それ詐欺かも",
      createdAt: w.clock.t,
    });
    await child.markSeen(ID); // 子が書いても何も起きない
    assert.equal((await parent.getConsultation(ID)).parentSeenAt, undefined);
    w.clock.t += MIN;
    await parent.markSeen(ID);
    assert.equal((await parent.getConsultation(ID)).parentSeenAt, w.clock.t);
  });

  test("空白だけ・200 字を超える返信は拒否（アプリ側の規則。DB の check より厳しい）", async () => {
    const { child, parent, pairId } = await paired();
    await parent.insertConsultation({ id: ID, pairId, category: "money" });
    await assert.rejects(child.insertReply(ID, "safe", "  "), /check/);
    await assert.rejects(
      child.insertReply(ID, "safe", "あ".repeat(201)),
      /check/,
    );
    await child.insertReply(ID, "safe", "あ".repeat(200));
  });

  test("他人にはペアの相談が 0 行で、書き込みも拒否", async () => {
    const { w, parent, pairId } = await paired();
    await parent.insertConsultation({ id: ID, pairId, category: "money" });
    const other = await signedIn(w, "parent");
    assert.deepEqual(await other.listConsultations(pairId, 50), []);
    assert.equal(await other.getConsultation(ID), null);
    await assert.rejects(
      other.insertConsultation({
        id: "20000000-0000-4000-8000-000000000002",
        pairId,
        category: "money",
      }),
      /row-level security/,
    );
  });

  test("一覧は新しい順で、件数の上限で切る", async () => {
    const { w, child, parent, pairId } = await paired();
    for (let i = 1; i <= 3; i++) {
      w.clock.t += MIN;
      await parent.insertConsultation({
        id: `30000000-0000-4000-8000-00000000000${i}`,
        pairId,
        category: "other",
      });
    }
    const list = await child.listConsultations(pairId, 2);
    assert.deepEqual(
      list.map((c) => c.id.slice(-1)),
      ["3", "2"],
    );
  });

  test("別の端末の書き込みが購読に届く（相談 1 件の id と、ペアの変化）", async () => {
    const w = world();
    const child = await signedIn(w, "child");
    const parent = await signedIn(w, "parent");
    const { pairId } = await child.getPair();
    const events = [];
    const stop = child.subscribePair(pairId, (e) => events.push(e));
    await Promise.resolve(); // 最初の resync
    const { code } = await child.createInvite();
    await parent.redeemInvite(code);
    await parent.insertConsultation({ id: ID, pairId, category: "money" });
    stop();
    await parent.insertConsultation({
      id: "20000000-0000-4000-8000-000000000009",
      pairId,
      category: "money",
    });
    assert.deepEqual(events, [
      { kind: "resync" },
      { kind: "pair" },
      { kind: "consultation", id: ID },
    ]);
  });
});

// ---- SupabaseBackend: 呼び出しを記録する偽の client ----
const UID = "00000000-0000-4000-8000-0000000000aa";
const PAIR = "40000000-0000-4000-8000-000000000001";

function recordingClient(responses = {}) {
  const calls = [];
  const channels = [];
  const removed = [];
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
  return {
    calls,
    channels,
    removed,
    from,
    async rpc(name, args) {
      calls.push({ rpc: name, args });
      return responses[name] ?? { data: null, error: null };
    },
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signInAnonymously() {
        calls.push({ auth: "signInAnonymously" });
        return { data: { user: { id: UID } }, error: null };
      },
      async signOut() {
        calls.push({ auth: "signOut" });
        return { error: null };
      },
    },
    channel(name) {
      const ch = {
        name,
        listeners: [],
        on(type, filter, cb) {
          this.listeners.push({ type, filter, cb });
          return this;
        },
        subscribe(cb) {
          this.statusCb = cb;
          return this;
        },
      };
      channels.push(ch);
      return ch;
    },
    async removeChannel(ch) {
      removed.push(ch);
      return "ok";
    },
  };
}

// 表の変更を聞く listener（system など表を持たないものを除く）。
function pgListeners(ch) {
  return ch.listeners.filter((l) => l.type === "postgres_changes");
}

// 配信が始まったときの system メッセージ（本物の Realtime のフレームで実測した形）。
const SYSTEM_SUBSCRIBED = {
  message: "Subscribed to PostgreSQL",
  status: "ok",
  extension: "postgres_changes",
  channel: `pair:${PAIR}`,
};

function systemListener(ch) {
  const ls = ch.listeners.filter((l) => l.type === "system");
  assert.equal(ls.length, 1, "system の listener は 1 つ");
  return ls[0];
}

async function driveAll(client) {
  const b = new SupabaseBackend(client);
  assert.equal(await b.signIn(), UID);
  await b.getRole();
  await b.setRole("parent");
  await b.createPair().catch(() => {}); // 偽の client は id を返さない
  await b.createInvite().catch(() => {});
  await b.redeemInvite("123456");
  await b.getPair();
  await b.listConsultations(PAIR, 50);
  await b.getConsultation("c1");
  await b.insertConsultation({ id: "c1", pairId: PAIR, category: "money" });
  await b.insertReply("c1", "danger", "それ詐欺かも");
  await b.markSeen("c1");
  await b.upsertPushToken("ExponentPushToken[x]");
  const events = [];
  const stop = b.subscribePair(PAIR, (e) => events.push(e));
  return { b, events, stop };
}

// 移行 SQL を全部（フォルダから動的に列挙・0 本なら失敗）。足した関数も照合の対象に入る。
const MIGRATIONS_DIR = new URL("../supabase/migrations/", import.meta.url);
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();
if (MIGRATION_FILES.length === 0) throw new Error("移行 SQL がありません");
const ALL_SQL = MIGRATION_FILES.map((f) =>
  readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"),
).join("\n");
const REALTIME_SQL = readFileSync(
  new URL(
    "../supabase/migrations/20261016000001_realtime.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("SupabaseBackend: 呼ぶ表・関数・filter", () => {
  test("匿名サインインを使い、呼ぶ表名と関数名はこの組だけ", async () => {
    const client = recordingClient();
    await driveAll(client);
    assert.ok(client.calls.some((c) => c.auth === "signInAnonymously"));
    const tables = [
      ...new Set(client.calls.filter((c) => c.table).map((c) => c.table)),
    ].sort();
    const rpcs = [
      ...new Set(client.calls.filter((c) => c.rpc).map((c) => c.rpc)),
    ].sort();
    assert.deepEqual(tables, ["consultations", "pairs", "profiles", "replies"]);
    assert.deepEqual(rpcs, [
      "create_invite",
      "redeem_invite",
      "register_push_token",
    ]);
  });

  test("表名は移行 SQL（supabase/migrations/ の全部）に create table public.<名> として、関数名は create function public.<名> として実在する", async () => {
    const client = recordingClient();
    await driveAll(client);
    const tables = new Set(
      client.calls.filter((c) => c.table).map((c) => c.table),
    );
    const rpcs = new Set(client.calls.filter((c) => c.rpc).map((c) => c.rpc));
    for (const ch of client.channels)
      for (const l of pgListeners(ch)) tables.add(l.filter.table);
    assert.ok(tables.size > 0 && rpcs.size > 0, "0 件なら検査になっていない");
    for (const t of tables)
      assert.ok(ALL_SQL.includes(`create table public.${t} (`), `表 ${t}`);
    for (const r of rpcs)
      assert.ok(ALL_SQL.includes(`create function public.${r}(`), `関数 ${r}`);
  });

  test("購読する表は Realtime の publication に入っている", async () => {
    const client = recordingClient();
    await driveAll(client);
    const tables = client.channels.flatMap((ch) =>
      pgListeners(ch).map((l) => l.filter.table),
    );
    assert.ok(tables.length > 0);
    for (const t of tables)
      assert.ok(REALTIME_SQL.includes(`public.${t}`), `publication に ${t}`);
  });

  test("引数・filter・列: 招待の引き換えは { code }、相談の一覧は pair_id で絞って新しい順に 50 件", async () => {
    const client = recordingClient();
    await driveAll(client);
    assert.deepEqual(client.calls.find((c) => c.rpc === "redeem_invite").args, {
      code: "123456",
    });
    const list = client.calls.find(
      (c) =>
        c.table === "consultations" && c.ops.some(([op]) => op === "order"),
    );
    assert.deepEqual(list.ops, [
      ["select", CONSULTATION_COLUMNS],
      ["eq", "pair_id", PAIR],
      ["order", "created_at", { ascending: false }],
      ["limit", 50],
    ]);
    assert.match(
      CONSULTATION_COLUMNS,
      /replies\(verdict, message, created_at\)/,
    );
    const insert = client.calls.find(
      (c) =>
        c.table === "consultations" && c.ops.some(([op]) => op === "insert"),
    );
    // status は送らない（DB は status を grant していない。トリガーだけが変える）
    assert.deepEqual(insert.ops, [
      [
        "insert",
        { id: "c1", pair_id: PAIR, created_by: UID, category: "money" },
      ],
    ]);
    const reply = client.calls.find((c) => c.table === "replies");
    assert.deepEqual(reply.ops, [
      [
        "insert",
        {
          consultation_id: "c1",
          replied_by: UID,
          verdict: "danger",
          message: "それ詐欺かも",
        },
      ],
    ]);
    const seen = client.calls.find(
      (c) =>
        c.table === "consultations" && c.ops.some(([op]) => op === "update"),
    );
    assert.deepEqual(Object.keys(seen.ops[0][1]), ["parent_seen_at"]);
    assert.deepEqual(seen.ops[1], ["eq", "id", "c1"]);
  });

  test("購読: チャンネル pair:<id> で consultations（pair_id=eq.<id>）と pairs（id=eq.<id>）を聞く", async () => {
    const client = recordingClient();
    const { events, stop } = await driveAll(client);
    assert.equal(client.channels.length, 1);
    const [ch] = client.channels;
    assert.equal(ch.name, `pair:${PAIR}`);
    assert.deepEqual(
      pgListeners(ch).map((l) => [l.type, l.filter]),
      [
        [
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "consultations",
            filter: `pair_id=eq.${PAIR}`,
          },
        ],
        [
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "pairs",
            filter: `id=eq.${PAIR}`,
          },
        ],
      ],
    );
    const [consultations, pairs] = pgListeners(ch);
    ch.statusCb("SUBSCRIBED");
    consultations.cb({ new: { id: "c9" }, old: {} });
    pairs.cb({ new: { id: PAIR }, old: {} });
    ch.statusCb("CHANNEL_ERROR");
    assert.deepEqual(events, [
      { kind: "resync" },
      { kind: "consultation", id: "c9" },
      { kind: "pair" },
    ]);
    stop();
    assert.deepEqual(client.removed, [ch]);
  });

  test("購読: 変更の配信が始まった system メッセージ（status ok）で 1 回 resync を出す", async () => {
    const client = recordingClient();
    const { events } = await driveAll(client);
    const [ch] = client.channels;
    const sys = systemListener(ch);
    assert.deepEqual(sys.filter, {});
    ch.statusCb("SUBSCRIBED");
    sys.cb(SYSTEM_SUBSCRIBED);
    assert.deepEqual(events, [{ kind: "resync" }, { kind: "resync" }]);
  });

  test("購読: system メッセージが ok でない・postgres_changes のものでないときは resync を出さない", async () => {
    const client = recordingClient();
    const { events } = await driveAll(client);
    const sys = systemListener(client.channels[0]);
    sys.cb({ ...SYSTEM_SUBSCRIBED, status: "error", message: "失敗" });
    sys.cb({ ...SYSTEM_SUBSCRIBED, extension: "system" });
    sys.cb(undefined);
    sys.cb({});
    assert.deepEqual(events, []);
  });

  test("行の読み取り: status と返信の組が合わない行は一覧から落とす", async () => {
    const ok = {
      id: "c1",
      category: "money",
      photo_path: null,
      status: "waiting",
      parent_seen_at: null,
      created_at: "2026-10-16T00:00:00Z",
      replies: null,
    };
    const broken = { ...ok, id: "c2", status: "answered" };
    const client = recordingClient({
      consultations: { data: [ok, broken], error: null },
    });
    const b = new SupabaseBackend(client);
    await b.signIn();
    const list = await b.listConsultations(PAIR, 50);
    assert.deepEqual(
      list.map((c) => c.id),
      ["c1"],
    );
  });

  test("引き換えの結果: 知らない reason は invalid、ok は reason も ok のときだけ", async () => {
    const client = recordingClient({
      redeem_invite: { data: { ok: true, reason: "???" }, error: null },
    });
    const b = new SupabaseBackend(client);
    await b.signIn();
    assert.deepEqual(await b.redeemInvite("111111"), {
      ok: false,
      reason: "invalid",
    });
  });

  test("DB のエラーは例外にする", async () => {
    const client = recordingClient({
      consultations: { data: null, error: { message: "permission denied" } },
    });
    const b = new SupabaseBackend(client);
    await b.signIn();
    await assert.rejects(
      b.insertConsultation({ id: "c1", pairId: PAIR, category: "money" }),
      /permission denied/,
    );
  });
});

// 保存したセッションが読めないときに新しい匿名ユーザーを作ると、元のペアから黙って外れる。
function memoryMark(marked = false) {
  return {
    get marked() {
      return marked;
    },
    has: async () => marked,
    set: async () => {
      marked = true;
    },
    clear: async () => {
      marked = false;
    },
  };
}

describe("SupabaseBackend: サインインと端末の印", () => {
  test("初めての端末では匿名で作り、サインインした印を置く", async () => {
    const client = recordingClient();
    const mark = memoryMark();
    const b = new SupabaseBackend(client, mark);
    assert.equal(await b.signIn(), UID);
    assert.ok(client.calls.some((c) => c.auth === "signInAnonymously"));
    assert.equal(mark.marked, true);
  });

  test("保存したセッションがあれば、それを使い新しく作らない", async () => {
    const client = recordingClient();
    client.auth.getSession = async () => ({
      data: { session: { user: { id: "u-saved" } } },
      error: null,
    });
    const mark = memoryMark();
    const b = new SupabaseBackend(client, mark);
    assert.equal(await b.signIn(), "u-saved");
    assert.ok(!client.calls.some((c) => c.auth === "signInAnonymously"));
    assert.equal(mark.marked, true);
  });

  test("セッションの読み込みが失敗したら、新しい利用者を作らずに失敗する", async () => {
    const client = recordingClient();
    client.auth.getSession = async () => ({
      data: { session: null },
      error: { message: "refresh failed" },
    });
    const b = new SupabaseBackend(client, memoryMark());
    await assert.rejects(b.signIn(), /getSession: refresh failed/);
    assert.ok(!client.calls.some((c) => c.auth === "signInAnonymously"));
  });

  test("前にサインインした印があるのにセッションが無ければ、新しい利用者を作らずに失敗する", async () => {
    const client = recordingClient();
    const b = new SupabaseBackend(client, memoryMark(true));
    await assert.rejects(b.signIn(), /保存したセッションがありません/);
    assert.ok(!client.calls.some((c) => c.auth === "signInAnonymously"));
  });

  test("自分でサインアウトしたら印を消し、次は新しい匿名ユーザーを作れる", async () => {
    const client = recordingClient();
    const mark = memoryMark(true);
    const b = new SupabaseBackend(client, mark);
    await b.signOut();
    assert.equal(mark.marked, false);
    assert.equal(await b.signIn(), UID);
    assert.ok(client.calls.some((c) => c.auth === "signInAnonymously"));
  });
});

describe("ペアリングの純関数", () => {
  test("起動時の状態: ペアが active なら paired、無ければ役割で分かれる", () => {
    const active = { pairId: "p", role: "child", status: "active" };
    const pending = { pairId: "p", role: "child", status: "pending" };
    assert.equal(sessionStatusOf(null, null), "choose_role");
    assert.equal(sessionStatusOf("child", pending), "child_unpaired");
    assert.equal(sessionStatusOf("child", null), "child_unpaired");
    assert.equal(sessionStatusOf("parent", null), "parent_unpaired");
    assert.equal(sessionStatusOf("child", active), "paired");
    assert.equal(
      sessionStatusOf("parent", { ...active, role: "parent" }),
      "paired",
    );
  });

  test("残り時間は 分:秒（秒は 2 桁、切り上げ、負は 0:00）", () => {
    assert.equal(formatRemaining(10 * MIN, 0), "10:00");
    assert.equal(formatRemaining(65_000, 0), "1:05");
    assert.equal(formatRemaining(1, 0), "0:01");
    assert.equal(formatRemaining(0, 5), "0:00");
  });

  test("失敗の理由はどれも空でない 1 文で、互いに違う", () => {
    const reasons = [
      "too_many_attempts",
      "invalid",
      "expired",
      "used",
      "not_parent",
      "already_paired",
    ];
    const msgs = reasons.map(redeemMessage);
    for (const m of msgs) assert.ok(typeof m === "string" && m.length > 0);
    assert.equal(new Set(msgs).size, reasons.length);
    for (const r of reasons) assert.equal(toRedeemReason(r), r);
    assert.equal(toRedeemReason("ok"), "ok");
    assert.equal(toRedeemReason("nope"), "invalid");
    assert.equal(toRedeemReason(undefined), "invalid");
  });

  test("番号の形は数字 6 桁だけ", () => {
    assert.ok(isInviteCode("012345"));
    for (const s of ["12345", "1234567", "12345a", " 123456", ""])
      assert.ok(!isInviteCode(s), s);
  });
});
