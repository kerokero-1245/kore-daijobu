// Supabase の移行 SQL（supabase/migrations/ の 20261016000000_init.sql と 20261017000000_push_token_claim.sql）の
// RLS と整合を、PGlite で検査する。
// 守るもの:
//   - 親子の当事者だけが自分のペアの行を読め、他人は全表 0 行・書き込み拒否
//   - 相談を作れるのは親、返信できるのは子だけ（役割違いの書き込みは拒否）
//   - status は返信の挿入トリガーだけが変える（直接の update は grant で拒否、二重返信も拒否）
//   - 招待は期限 10 分・使い切り・10 分で失敗 5 回まで。招待・試行・送信記録はクライアントから読めない
//   - 通知のトークンは register_push_token で、前の利用者の行が残っていても持ち主が移る（未認証は断る）
// Supabase 固有の auth.uid()・auth.users・role anon / authenticated と、public の既定の grant は下で代わりを作る。
// 流すのは init.sql → push_token_claim.sql の順（名前の順＝本番で流す順）。
// realtime.sql（20261016000001）は `alter publication supabase_realtime` だけで、その publication は
// Supabase が作るもので PGlite には無いので流さない（表・関数・権限は変えないので検査の範囲に影響しない）。
// 環境変数 KORE_INIT_SQL・KORE_CLAIM_SQL で移行 SQL の場所を差し替えられる（変異で red を確かめるため）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, test } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { CATEGORY_ORDER } from "../src/domain/category.ts";
import { MAX_REPLY_LENGTH } from "../src/domain/reply.ts";

const MIGRATIONS = [
  process.env.KORE_INIT_SQL ??
    new URL("../supabase/migrations/20261016000000_init.sql", import.meta.url),
  process.env.KORE_CLAIM_SQL ??
    new URL(
      "../supabase/migrations/20261017000000_push_token_claim.sql",
      import.meta.url,
    ),
];

// Supabase にあって素の Postgres に無いもの。auth.uid() は Supabase と同じく JWT の sub を読む。
// public の既定の grant（anon・authenticated に全権）も Supabase に合わせ、移行の revoke が効くかを試す。
const SUPABASE_STANDIN = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

const PARENT = "00000000-0000-4000-8000-00000000000a";
const CHILD = "00000000-0000-4000-8000-00000000000c";
const OTHER = "00000000-0000-4000-8000-00000000000f";
const NO_PROFILE = "00000000-0000-4000-8000-0000000000ff";
const K1 = "10000000-0000-4000-8000-000000000001";
const K2 = "10000000-0000-4000-8000-000000000002";
const ACTORS = { 親: PARENT, 子: CHILD, 他人: OTHER };

let db;
let pairId;
const results = []; // { actor, table, op, expected, actual }

// 失敗を種類に寄せる。期待はこの語で書く。
function classify(e) {
  const msg = String(e?.message ?? e);
  if (e?.code === "42501" && msg.includes("row-level security")) return "rls";
  if (e?.code === "42501") return "grant";
  if (e?.code === "23505") return "unique";
  if (e?.code === "23514") return "check";
  if (e?.code === "P0001") return "raise";
  return `error:${e?.code ?? msg}`;
}

const ROLLBACK = Symbol("rollback");

// actor の立場で fn を 1 トランザクションで走らせ、結果の語を返す。
// actor: 親 / 子 / 他人（authenticated）・anon・service（RLS を越える管理者。Edge Function の service role の代わり）
async function runAs(actor, fn, { rollback = false } = {}) {
  let out;
  try {
    await db.transaction(async (tx) => {
      if (actor === "anon") {
        await tx.exec("set local role anon");
      } else if (actor !== "service") {
        await tx.exec("set local role authenticated");
        await tx.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: ACTORS[actor], role: "authenticated" }),
        ]);
      }
      out = await fn(tx);
      if (rollback) throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) return { label: classify(e), error: e };
  }
  return { label: out.label, value: out.value };
}

const rowsOf = (res) => ({ label: `${res.rows.length} 行`, value: res.rows });
const affected = (res) => ({ label: `${res.affectedRows ?? 0} 行` });

// 期待と実測を表に記録し、その場でも比べる。
async function check(actor, table, op, expected, fn, opts) {
  const r = await runAs(actor, fn, opts);
  results.push({ actor, table, op, expected, actual: r.label });
  assert.equal(
    r.label,
    expected,
    `${actor} × ${table} × ${op}: 期待 ${expected}、実測 ${r.label}${r.error ? `（${r.error.message}）` : ""}`,
  );
  return r.value;
}

const select = (sql, params) => async (tx) =>
  rowsOf(await tx.query(sql, params));
const write = (sql, params) => async (tx) =>
  affected(await tx.query(sql, params));
const rpc = (sql, params) => async (tx) => {
  const v = (await tx.query(sql, params)).rows[0].r;
  return {
    label: v.reason ?? (/^\d{6}$/.test(v.code) ? "code" : "?"),
    value: v,
  };
};
const createInvite = rpc("select public.create_invite() as r");
const redeem = (code) => rpc("select public.redeem_invite($1) as r", [code]);

describe("移行 SQL の RLS と整合（PGlite）", () => {
  before(async () => {
    db = new PGlite();
    await db.exec(SUPABASE_STANDIN);
    for (const m of MIGRATIONS) await db.exec(readFileSync(m, "utf8"));
    await db.exec(
      `insert into auth.users (id) values ('${PARENT}'), ('${CHILD}'), ('${OTHER}'), ('${NO_PROFILE}')`,
    );
  });
  after(async () => {
    await db?.close();
  });

  test("public の表はすべて RLS が有効（表から動的に列挙・0 件なら失敗）", async () => {
    const { rows } = await db.query(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    );
    assert.equal(rows.length, 8, `表の数: ${rows.map((r) => r.relname)}`);
    for (const r of rows) assert.equal(r.relrowsecurity, true, r.relname);
  });

  test("profiles: 各自が自分の行だけ作れ、名前だけ直せる", async () => {
    await check(
      "子",
      "profiles",
      "insert 自分",
      "1 行",
      write(
        "insert into public.profiles (id, role, display_name) values ($1, 'child', 'たろう')",
        [CHILD],
      ),
    );
    await check(
      "親",
      "profiles",
      "insert 自分",
      "1 行",
      write(
        "insert into public.profiles (id, role, display_name) values ($1, 'parent', 'お母さん')",
        [PARENT],
      ),
    );
    await check(
      "他人",
      "profiles",
      "insert 自分",
      "1 行",
      write(
        "insert into public.profiles (id, role, display_name) values ($1, 'parent', 'たにん')",
        [OTHER],
      ),
    );
    await check(
      "他人",
      "profiles",
      "insert 他人の id",
      "rls",
      write(
        "insert into public.profiles (id, role, display_name) values ($1, 'parent', 'なりすまし')",
        [NO_PROFILE],
      ),
    );
    await check(
      "子",
      "profiles",
      "update role",
      "grant",
      write("update public.profiles set role = 'parent' where id = $1", [
        CHILD,
      ]),
    );
    await check(
      "子",
      "profiles",
      "update display_name 自分",
      "1 行",
      write(
        "update public.profiles set display_name = 'たろう' where id = $1",
        [CHILD],
      ),
    );
    await check(
      "子",
      "profiles",
      "update display_name 親（未ペア）",
      "0 行",
      write("update public.profiles set display_name = 'x' where id = $1", [
        PARENT,
      ]),
    );
    await check(
      "anon",
      "profiles",
      "select",
      "grant",
      select("select * from public.profiles"),
    );
  });

  test("pairs: 子が pending で作り、他人は作れず読めない", async () => {
    const rows = await check(
      "子",
      "pairs",
      "insert pending",
      "1 行",
      async (tx) => {
        const res = await tx.query(
          "insert into public.pairs (child_id) values ($1) returning id",
          [CHILD],
        );
        return { label: `${res.rows.length} 行`, value: res.rows };
      },
    );
    pairId = rows[0].id;
    await check(
      "他人",
      "pairs",
      "insert active を直接",
      "rls",
      write(
        "insert into public.pairs (child_id, parent_id, status) values ($1, $2, 'active')",
        [OTHER, PARENT],
      ),
    );
    await check(
      "子",
      "pairs",
      "update status を直接",
      "grant",
      write("update public.pairs set status = 'active', parent_id = $1", [
        PARENT,
      ]),
    );
    await check(
      "他人",
      "pairs",
      "select",
      "0 行",
      select("select * from public.pairs"),
    );
  });

  test("招待: 期限切れ・古いコード・総当たり・役割違い・使用済みを断り、正しいコードで結ぶ", async () => {
    await check("anon", "create_invite", "rpc", "grant", createInvite);
    await check(
      "親",
      "create_invite",
      "rpc（pending のペアなし）",
      "raise",
      createInvite,
    );
    const a = await check("子", "create_invite", "rpc", "code", createInvite);
    await check(
      "子",
      "pair_invites",
      "select",
      "grant",
      select("select * from public.pair_invites"),
    );

    await check(
      "service",
      "pair_invites",
      "update expires_at を過去に",
      "1 行",
      write(
        "update public.pair_invites set expires_at = now() - interval '1 second' where code = $1",
        [a.code],
      ),
    );
    await check(
      "親",
      "redeem_invite",
      "rpc 期限切れ",
      "expired",
      redeem(a.code),
    );

    const b = await check(
      "子",
      "create_invite",
      "rpc 出し直し",
      "code",
      createInvite,
    );
    if (b.code !== a.code) {
      await check(
        "親",
        "redeem_invite",
        "rpc 出し直し前のコード",
        "invalid",
        redeem(a.code),
      );
    }
    await check(
      "service",
      "pair_invites",
      "select 期限と未使用",
      "1 行",
      select(
        `select 1 from public.pair_invites where code = $1 and used_at is null
         and expires_at between now() + interval '9 minutes 30 seconds' and now() + interval '10 minutes'`,
        [b.code],
      ),
    );

    const wrong = b.code === "000000" ? "000001" : "000000";
    for (let i = 1; i <= 5; i++) {
      await check(
        "他人",
        "redeem_invite",
        `rpc 誤コード ${i} 回目`,
        "invalid",
        redeem(wrong),
      );
    }
    await check(
      "他人",
      "redeem_invite",
      "rpc 誤コード 6 回目",
      "too_many_attempts",
      redeem(wrong),
    );
    await check(
      "他人",
      "redeem_invite",
      "rpc 正しいコード（上限後）",
      "too_many_attempts",
      redeem(b.code),
    );
    await check(
      "子",
      "redeem_invite",
      "rpc 自分のコード",
      "not_parent",
      redeem(b.code),
    );

    await check(
      "親",
      "redeem_invite",
      "rpc 正しいコード",
      "ok",
      redeem(b.code),
    );
    await check(
      "service",
      "pairs",
      "select active と親",
      "1 行",
      select(
        "select 1 from public.pairs where id = $1 and status = 'active' and parent_id = $2",
        [pairId, PARENT],
      ),
    );
    await check(
      "service",
      "pair_invites",
      "select 使用済みの印",
      "1 行",
      select(
        "select 1 from public.pair_invites where code = $1 and used_at is not null and used_by = $2",
        [b.code, PARENT],
      ),
    );
    await check(
      "親",
      "redeem_invite",
      "rpc 使用済みの再利用",
      "used",
      redeem(b.code),
    );
    await check(
      "service",
      "invite_attempts",
      "select 他人の失敗の記録",
      "7 行",
      select(
        "select 1 from public.invite_attempts where user_id = $1 and not ok",
        [OTHER],
      ),
    );
    await check(
      "他人",
      "pairs",
      "select（ペア成立後）",
      "0 行",
      select("select * from public.pairs"),
    );
    await check(
      "親",
      "pairs",
      "select",
      "1 行",
      select("select * from public.pairs"),
    );
  });

  test("consultations: 親だけが作れ、他人は読めない", async () => {
    const ins = (id, by, category = "money") =>
      write(
        "insert into public.consultations (id, pair_id, created_by, category) values ($1, $2, $3, $4)",
        [id, pairId, by, category],
      );
    await check("親", "consultations", "insert", "1 行", ins(K1, PARENT));
    await check("子", "consultations", "insert", "rls", ins(K2, CHILD));
    await check(
      "親",
      "consultations",
      "insert created_by を子に",
      "rls",
      ins(K2, CHILD),
    );
    await check("他人", "consultations", "insert", "rls", ins(K2, OTHER));
    await check(
      "親",
      "consultations",
      "insert status を指定",
      "grant",
      write(
        "insert into public.consultations (id, pair_id, created_by, category, status) values ($1, $2, $3, 'money', 'answered')",
        [K2, pairId, PARENT],
      ),
    );
    assert.ok(CATEGORY_ORDER.length > 0);
    for (const c of CATEGORY_ORDER) {
      await check(
        "親",
        "consultations",
        `insert category ${c}`,
        "1 行",
        ins(K2, PARENT, c),
        { rollback: true },
      );
    }
    await check(
      "親",
      "consultations",
      "insert category 表に無い種類",
      "check",
      ins(K2, PARENT, "unknown"),
    );
    await check(
      "親",
      "consultations",
      "select",
      "1 行",
      select("select * from public.consultations"),
    );
    await check(
      "子",
      "consultations",
      "select",
      "1 行",
      select("select * from public.consultations"),
    );
    await check(
      "他人",
      "consultations",
      "select",
      "0 行",
      select("select * from public.consultations"),
    );
    await check(
      "anon",
      "consultations",
      "select",
      "grant",
      select("select * from public.consultations"),
    );
    await check(
      "親",
      "consultations",
      "update parent_seen_at（返事待ち）",
      "0 行",
      write(
        "update public.consultations set parent_seen_at = now() where id = $1",
        [K1],
      ),
    );
  });

  test("replies: 子が 1 回だけ返し、status が answered に変わる", async () => {
    const reply = (by, message = "それは詐欺です") =>
      write(
        "insert into public.replies (consultation_id, replied_by, verdict, message) values ($1, $2, 'danger', $3)",
        [K1, by, message],
      );
    await check("親", "replies", "insert", "rls", reply(PARENT));
    await check("他人", "replies", "insert", "rls", reply(OTHER));
    await check(
      "子",
      "replies",
      "insert replied_by を親に",
      "rls",
      reply(PARENT),
    );
    await check(
      "子",
      "replies",
      `insert ${MAX_REPLY_LENGTH} 字`,
      "1 行",
      reply(CHILD, "あ".repeat(MAX_REPLY_LENGTH)),
      { rollback: true },
    );
    await check(
      "子",
      "replies",
      `insert ${MAX_REPLY_LENGTH + 1} 字`,
      "check",
      reply(CHILD, "あ".repeat(MAX_REPLY_LENGTH + 1)),
    );
    await check(
      "子",
      "replies",
      "insert 空白だけ",
      "check",
      reply(CHILD, "   "),
    );

    await check("子", "replies", "insert", "1 行", reply(CHILD));
    await check(
      "子",
      "consultations",
      "select status = answered",
      "1 行",
      select(
        "select 1 from public.consultations where id = $1 and status = 'answered'",
        [K1],
      ),
    );
    await check(
      "子",
      "replies",
      "insert 2 回目",
      "rls",
      reply(CHILD, "2 回目"),
    );
    await check(
      "service",
      "replies",
      "insert 2 回目（RLS を越えて）",
      "unique",
      reply(CHILD, "2 回目"),
    );
    await check(
      "子",
      "consultations",
      "update status を直接",
      "grant",
      write(
        "update public.consultations set status = 'waiting' where id = $1",
        [K1],
      ),
    );
    await check(
      "親",
      "consultations",
      "update status を直接",
      "grant",
      write(
        "update public.consultations set status = 'waiting' where id = $1",
        [K1],
      ),
    );
    await check(
      "親",
      "replies",
      "select",
      "1 行",
      select("select * from public.replies"),
    );
    await check(
      "他人",
      "replies",
      "select",
      "0 行",
      select("select * from public.replies"),
    );
  });

  test("parent_seen_at: 答えの出た相談で親だけが書ける", async () => {
    const seen = write(
      "update public.consultations set parent_seen_at = now() where id = $1",
      [K1],
    );
    await check("子", "consultations", "update parent_seen_at", "0 行", seen);
    await check("他人", "consultations", "update parent_seen_at", "0 行", seen);
    await check("親", "consultations", "update parent_seen_at", "1 行", seen);
    await check(
      "service",
      "consultations",
      "select parent_seen_at あり",
      "1 行",
      select(
        "select 1 from public.consultations where id = $1 and parent_seen_at is not null",
        [K1],
      ),
    );
  });

  test("push_tokens: 自分の行だけ読み書きできる", async () => {
    const ins = (token, user) =>
      write("insert into public.push_tokens (token, user_id) values ($1, $2)", [
        token,
        user,
      ]);
    await check(
      "親",
      "push_tokens",
      "insert 自分",
      "1 行",
      ins("ExponentPushToken[parent]", PARENT),
    );
    await check(
      "子",
      "push_tokens",
      "insert 自分",
      "1 行",
      ins("ExponentPushToken[child]", CHILD),
    );
    await check(
      "親",
      "push_tokens",
      "insert 子の行",
      "rls",
      ins("ExponentPushToken[fake]", CHILD),
    );
    await check(
      "親",
      "push_tokens",
      "select",
      "1 行",
      select("select * from public.push_tokens"),
    );
    await check(
      "他人",
      "push_tokens",
      "select",
      "0 行",
      select("select * from public.push_tokens"),
    );
    await check(
      "他人",
      "push_tokens",
      "update 親の行",
      "0 行",
      write(
        "update public.push_tokens set disabled_at = now() where user_id = $1",
        [PARENT],
      ),
    );
    await check(
      "他人",
      "push_tokens",
      "delete 親の行",
      "0 行",
      write("delete from public.push_tokens where user_id = $1", [PARENT]),
    );
  });

  test("push_tokens: register_push_token は前の利用者の行が残っていても持ち主を移し、disabled_at を null に戻す", async () => {
    const TOKEN = "ExponentPushToken[parent]";
    const owner = select(
      "select user_id, disabled_at from public.push_tokens where token = $1",
      [TOKEN],
    );
    const register = (token) => async (tx) => {
      await tx.query("select public.register_push_token($1)", [token]);
      return { label: "ok" };
    };
    // 前の利用者（親）の行が無効の印つきで残っている。
    await check(
      "service",
      "push_tokens",
      "update 親の行を無効に",
      "1 行",
      write(
        "update public.push_tokens set disabled_at = now() where token = $1",
        [TOKEN],
      ),
    );
    // 直接の upsert では移せない（tokens_own は変えていない）。
    await check(
      "子",
      "push_tokens",
      "upsert 親の行（直接）",
      "rls",
      write(
        "insert into public.push_tokens (token, user_id) values ($1, $2) on conflict (token) do update set user_id = excluded.user_id",
        [TOKEN, CHILD],
      ),
    );
    await check(
      "子",
      "push_tokens",
      "register_push_token 親の行",
      "ok",
      register(TOKEN),
    );
    const [row] = await check(
      "service",
      "push_tokens",
      "select 移したあと",
      "1 行",
      owner,
    );
    assert.equal(row.user_id, CHILD);
    assert.equal(row.disabled_at, null);
    // 同じ利用者の登録し直しも通る（起動のたびに呼ぶため）。
    await check(
      "子",
      "push_tokens",
      "register_push_token 自分の行",
      "ok",
      register(TOKEN),
    );
    await check(
      "子",
      "push_tokens",
      "register_push_token 空",
      "raise",
      register(" "),
    );
    // 未認証（auth.uid() が null）は断る。anon は execute の grant が無い。
    await check(
      "service",
      "push_tokens",
      "register_push_token 未認証（authenticated・sub なし）",
      "raise",
      async (tx) => {
        await tx.exec("set local role authenticated");
        return register("ExponentPushToken[nobody]")(tx);
      },
    );
    await check(
      "anon",
      "push_tokens",
      "register_push_token",
      "grant",
      register("ExponentPushToken[nobody]"),
    );
    await check(
      "service",
      "push_tokens",
      "select 未認証の行が無い",
      "0 行",
      select("select 1 from public.push_tokens where token = $1", [
        "ExponentPushToken[nobody]",
      ]),
    );
    // tokens_own は 1 本目のまま（自分の行だけ・for all）。
    const policies = await check(
      "service",
      "pg_policies",
      "select push_tokens のポリシー",
      "1 行",
      select(
        "select policyname, cmd, qual, with_check from pg_policies where tablename = 'push_tokens'",
      ),
    );
    assert.deepEqual(policies, [
      {
        policyname: "tokens_own",
        cmd: "ALL",
        qual: "(user_id = ( SELECT auth.uid() AS uid))",
        with_check: "(user_id = ( SELECT auth.uid() AS uid))",
      },
    ]);
  });

  test("pair_invites / invite_attempts / push_log: authenticated は grant で読めず、grant を足しても RLS で 0 行", async () => {
    await check(
      "service",
      "push_log",
      "insert",
      "1 行",
      write(
        "insert into public.push_log (event, status) values ('consultation', 'ok')",
      ),
    );
    for (const t of ["pair_invites", "invite_attempts", "push_log"]) {
      await check(
        "service",
        t,
        "select（行があること）",
        "1 行",
        select(`select 1 from public.${t} limit 1`),
      );
      for (const actor of ["親", "子", "他人"]) {
        await check(
          actor,
          t,
          "select",
          "grant",
          select(`select * from public.${t}`),
        );
      }
      // grant が誤って付いた日でも、ポリシーが無いので 0 行になること（二重の守り）。
      await check(
        "親",
        t,
        "select（grant を一時的に足して）",
        "0 行",
        async (tx) => {
          await tx.exec(
            `reset role; grant select on public.${t} to authenticated; set local role authenticated`,
          );
          return rowsOf(await tx.query(`select * from public.${t}`));
        },
        { rollback: true },
      );
    }
  });

  test("profiles: ペアの相手は読め、他人は自分だけ", async () => {
    await check(
      "親",
      "profiles",
      "select",
      "2 行",
      select("select * from public.profiles"),
    );
    await check(
      "子",
      "profiles",
      "select",
      "2 行",
      select("select * from public.profiles"),
    );
    await check(
      "他人",
      "profiles",
      "select",
      "1 行",
      select("select * from public.profiles"),
    );
    await check(
      "他人",
      "profiles",
      "update display_name 親",
      "0 行",
      write("update public.profiles set display_name = 'x' where id = $1", [
        PARENT,
      ]),
    );
  });

  test("期待と実測の表が全件一致する（0 件なら失敗）", () => {
    assert.ok(results.length > 0, "表が空");
    const table = results
      .map(
        (r) =>
          `${r.actual === r.expected ? "一致" : "不一致"} | ${r.actor} | ${r.table} | ${r.op} | ${r.expected} | ${r.actual}`,
      )
      .join("\n");
    console.log(`判定 | actor | table | op | 期待 | 実測\n${table}`);
    const mismatches = results.filter((r) => r.actual !== r.expected);
    console.log(`件数 ${results.length}・不一致 ${mismatches.length}`);
    assert.deepEqual(mismatches, []);
  });
});
