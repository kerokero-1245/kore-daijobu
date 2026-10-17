// 端末内の偽バックエンド。Supabase の設定が無いときと、テストで使う。
// 中身は DB と同じ形の行（snake_case・時刻は ISO 文字列）で持ち、読むときは rowToConsultation を通す。
// 権限と招待の規則は supabase/migrations/20261016000000_init.sql（RLS・create_invite・redeem_invite・
// 返信のトリガー）と同じ順で検査する。保存先は FakeStorage で差し替える:
//   Web … データは localStorage（タブ間で共有し、storage イベントで他タブへ伝える）、
//          サインイン中の利用者は sessionStorage（タブごとに別の人 = 2 タブで親子を試せる）
//   テスト … メモリ（createMemoryHub で「端末」を何台でも作れる）
// React・React Native・supabase-js に依存しない。

import type { Category, Consultation, Verdict } from "../types";
import type {
  Backend,
  Invite,
  NewConsultationRow,
  PairChange,
  RedeemResult,
} from "./backend";
import {
  ATTEMPT_WINDOW_MS,
  INVITE_TTL_MS,
  MAX_FAILED_ATTEMPTS,
  type PairInfo,
  type RedeemReason,
  type Role,
} from "../domain/pairing";
import { rowToConsultation } from "../domain/row";
import { MAX_REPLY_LENGTH } from "../domain/reply";

// ---- 保存先 ----

export interface FakeStorage {
  readDb(): string | null;
  writeDb(json: string): void;
  // 他の端末（タブ）がデータを書いたら呼ぶ。返り値でやめる。
  onExternalChange(cb: () => void): () => void;
  readSession(): string | null;
  writeSession(uid: string | null): void;
}

// メモリの共有の場。device() ごとにサインイン中の利用者が別になる。
export function createMemoryHub(): { device(): FakeStorage } {
  let db: string | null = null;
  const devices = new Set<{ notify: () => void }>();
  return {
    device() {
      let session: string | null = null;
      const listeners = new Set<() => void>();
      const me = { notify: () => listeners.forEach((cb) => cb()) };
      devices.add(me);
      return {
        readDb: () => db,
        writeDb(json) {
          db = json;
          devices.forEach((d) => {
            if (d !== me) d.notify();
          });
        },
        onExternalChange(cb) {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
        readSession: () => session,
        writeSession(uid) {
          session = uid;
        },
      };
    },
  };
}

// ブラウザの保存先（Web で Supabase の設定が無いとき）。
interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
interface StorageEventTarget {
  addEventListener(
    type: "storage",
    cb: (e: { key: string | null }) => void,
  ): void;
  removeEventListener(
    type: "storage",
    cb: (e: { key: string | null }) => void,
  ): void;
}

const DB_KEY = "kore-daijobu:fake-db";
const SESSION_KEY = "kore-daijobu:fake-session";

export function createWebFakeStorage(
  local: WebStorageLike,
  session: WebStorageLike,
  target: StorageEventTarget,
): FakeStorage {
  return {
    readDb: () => local.getItem(DB_KEY),
    writeDb: (json) => local.setItem(DB_KEY, json),
    onExternalChange(cb) {
      const handler = (e: { key: string | null }) => {
        if (e.key === DB_KEY || e.key === null) cb();
      };
      target.addEventListener("storage", handler);
      return () => target.removeEventListener("storage", handler);
    },
    readSession: () => session.getItem(SESSION_KEY),
    writeSession: (uid) =>
      uid === null
        ? session.removeItem(SESSION_KEY)
        : session.setItem(SESSION_KEY, uid),
  };
}

// ---- 行の形（DB と同じ列名） ----

interface PairRow {
  id: string;
  child_id: string;
  parent_id: string | null;
  status: "pending" | "active";
  created_at: string;
}
interface InviteRow {
  code: string;
  pair_id: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
}
interface AttemptRow {
  user_id: string;
  ok: boolean;
  created_at: string;
}
interface ConsultationRow {
  id: string;
  pair_id: string;
  created_by: string;
  category: Category;
  photo_path: string | null;
  status: "waiting" | "answered";
  parent_seen_at: string | null;
  created_at: string;
}
interface ReplyRow {
  id: string;
  consultation_id: string;
  replied_by: string;
  verdict: Verdict;
  message: string;
  created_at: string;
}
interface FakeDb {
  users: string[];
  profiles: Record<string, { role: Role; display_name: string }>;
  pairs: PairRow[];
  invites: InviteRow[];
  attempts: AttemptRow[];
  consultations: ConsultationRow[];
  replies: ReplyRow[];
}

function emptyDb(): FakeDb {
  return {
    users: [],
    profiles: {},
    pairs: [],
    invites: [],
    attempts: [],
    consultations: [],
    replies: [],
  };
}

const CATEGORIES: Record<Category, true> = {
  money: true,
  refund: true,
  construction: true,
  impersonation: true,
  other: true,
};
const VERDICTS: Record<Verdict, true> = {
  danger: true,
  safe: true,
  unsure: true,
};

// DB のエラーに寄せた例外（code は Postgres のエラーコード）。
export class FakeDbError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface FakeBackendOptions {
  storage: FakeStorage;
  newId: () => string;
  now?: () => number;
  // 0 以上 max 未満の整数（招待コード用）。
  randomInt?: (max: number) => number;
}

export class FakeBackend implements Backend {
  #storage: FakeStorage;
  #newId: () => string;
  #now: () => number;
  #randomInt: (max: number) => number;
  #localListeners = new Set<() => void>();
  // 通知のトークン → 持ち主の uid。送る側が無いので、この端末のメモリに置くだけ。
  #pushTokens = new Map<string, string>();

  constructor(options: FakeBackendOptions) {
    this.#storage = options.storage;
    this.#newId = options.newId;
    this.#now = options.now ?? Date.now;
    this.#randomInt =
      options.randomInt ?? ((max) => Math.floor(Math.random() * max));
  }

  // ---- 内部 ----

  #read(): FakeDb {
    const json = this.#storage.readDb();
    if (!json) return emptyDb();
    try {
      return { ...emptyDb(), ...(JSON.parse(json) as Partial<FakeDb>) };
    } catch {
      return emptyDb();
    }
  }

  #write(db: FakeDb): void {
    this.#storage.writeDb(JSON.stringify(db));
    this.#localListeners.forEach((cb) => cb());
  }

  #iso(ms: number = this.#now()): string {
    return new Date(ms).toISOString();
  }

  #uid(): string {
    const uid = this.#storage.readSession();
    if (!uid) throw new FakeDbError("42501", "not signed in");
    return uid;
  }

  // private.my_role_in と同じ: active なペアの当事者なら役割、それ以外は null。
  #myRoleIn(db: FakeDb, pairId: string, uid: string): Role | null {
    const p = db.pairs.find((x) => x.id === pairId && x.status === "active");
    if (!p) return null;
    if (p.parent_id === uid) return "parent";
    if (p.child_id === uid) return "child";
    return null;
  }

  #toConsultation(db: FakeDb, c: ConsultationRow): Consultation | null {
    const r = db.replies.find((x) => x.consultation_id === c.id);
    return rowToConsultation({
      ...c,
      replies: r
        ? { verdict: r.verdict, message: r.message, created_at: r.created_at }
        : null,
    });
  }

  // ---- 認証と役割 ----

  async signIn(): Promise<string> {
    const current = this.#storage.readSession();
    if (current) return current;
    const uid = this.#newId();
    const db = this.#read();
    db.users.push(uid);
    this.#write(db);
    this.#storage.writeSession(uid);
    return uid;
  }

  async signOut(): Promise<void> {
    const uid = this.#storage.readSession();
    for (const [token, owner] of this.#pushTokens)
      if (owner === uid) this.#pushTokens.delete(token);
    this.#storage.writeSession(null);
  }

  async getRole(): Promise<Role | null> {
    const uid = this.#uid();
    return this.#read().profiles[uid]?.role ?? null;
  }

  async setRole(role: Role): Promise<void> {
    const uid = this.#uid();
    const db = this.#read();
    // profiles の PK と同じ。役割は作るときだけ決まり、update の grant も名前だけ。
    if (db.profiles[uid]) throw new FakeDbError("23505", "profile exists");
    db.profiles[uid] = { role, display_name: role === "parent" ? "親" : "子" };
    this.#write(db);
  }

  // ---- ペアと招待 ----

  async createPair(): Promise<string> {
    const uid = this.#uid();
    const db = this.#read();
    if (!db.profiles[uid]) throw new FakeDbError("23503", "no profile");
    if (db.pairs.some((p) => p.child_id === uid))
      throw new FakeDbError("23505", "pair exists");
    const id = this.#newId();
    db.pairs.push({
      id,
      child_id: uid,
      parent_id: null,
      status: "pending",
      created_at: this.#iso(),
    });
    this.#write(db);
    return id;
  }

  async createInvite(): Promise<Invite> {
    const uid = this.#uid();
    const db = this.#read();
    const pair = db.pairs.find(
      (p) => p.child_id === uid && p.status === "pending",
    );
    if (!pair) throw new FakeDbError("P0001", "no pending pair");
    db.invites = db.invites.filter(
      (i) => !(i.pair_id === pair.id && i.used_at === null),
    );
    const expiresAt = this.#now() + INVITE_TTL_MS;
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = this.#randomInt(1_000_000).toString().padStart(6, "0");
      if (db.invites.some((i) => i.code === code)) continue;
      db.invites.push({
        code,
        pair_id: pair.id,
        expires_at: this.#iso(expiresAt),
        used_at: null,
        used_by: null,
      });
      this.#write(db);
      return { code, expiresAt };
    }
    throw new FakeDbError("P0001", "could not allocate invite code");
  }

  async redeemInvite(code: string): Promise<RedeemResult> {
    const uid = this.#uid();
    const db = this.#read();
    const now = this.#now();
    const fail = (reason: RedeemReason): RedeemResult => {
      db.attempts.push({ user_id: uid, ok: false, created_at: this.#iso(now) });
      this.#write(db);
      return { ok: false, reason };
    };

    const fails = db.attempts.filter(
      (a) =>
        a.user_id === uid &&
        !a.ok &&
        Date.parse(a.created_at) > now - ATTEMPT_WINDOW_MS,
    ).length;
    if (fails >= MAX_FAILED_ATTEMPTS) return fail("too_many_attempts");

    const inv = db.invites.find((i) => i.code === code);
    const myRole = db.profiles[uid]?.role;
    if (!inv) return fail("invalid");
    if (inv.used_at !== null) return fail("used");
    if (Date.parse(inv.expires_at) <= now) return fail("expired");
    if (myRole !== "parent") return fail("not_parent");
    if (db.pairs.some((p) => p.parent_id === uid))
      return fail("already_paired");
    const pair = db.pairs.find(
      (p) => p.id === inv.pair_id && p.status === "pending",
    );
    if (!pair) return fail("already_paired");

    pair.parent_id = uid;
    pair.status = "active";
    inv.used_at = this.#iso(now);
    inv.used_by = uid;
    db.attempts.push({ user_id: uid, ok: true, created_at: this.#iso(now) });
    this.#write(db);
    return { ok: true, reason: "ok" };
  }

  async getPair(): Promise<PairInfo | null> {
    const uid = this.#uid();
    const p = this.#read().pairs.find(
      (x) => x.parent_id === uid || x.child_id === uid,
    );
    if (!p) return null;
    return {
      pairId: p.id,
      role: p.parent_id === uid ? "parent" : "child",
      status: p.status,
    };
  }

  // ---- 相談と返信 ----

  async listConsultations(
    pairId: string,
    limit: number,
  ): Promise<Consultation[]> {
    const uid = this.#uid();
    const db = this.#read();
    if (!this.#myRoleIn(db, pairId, uid)) return []; // RLS: 当事者でなければ 0 行
    return db.consultations
      .filter((c) => c.pair_id === pairId)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .slice(0, limit)
      .map((c) => this.#toConsultation(db, c))
      .filter((c): c is Consultation => c !== null);
  }

  async getConsultation(id: string): Promise<Consultation | null> {
    const uid = this.#uid();
    const db = this.#read();
    const c = db.consultations.find((x) => x.id === id);
    if (!c || !this.#myRoleIn(db, c.pair_id, uid)) return null;
    return this.#toConsultation(db, c);
  }

  async insertConsultation(c: NewConsultationRow): Promise<void> {
    const uid = this.#uid();
    const db = this.#read();
    // cons_ask: 作れるのは active なペアの親だけ。
    if (this.#myRoleIn(db, c.pairId, uid) !== "parent")
      throw new FakeDbError("42501", "row-level security: cons_ask");
    if (!Object.prototype.hasOwnProperty.call(CATEGORIES, c.category))
      throw new FakeDbError("23514", "category check");
    if (db.consultations.some((x) => x.id === c.id))
      throw new FakeDbError("23505", "duplicate id");
    db.consultations.push({
      id: c.id,
      pair_id: c.pairId,
      created_by: uid,
      category: c.category,
      photo_path: null,
      status: "waiting",
      parent_seen_at: null,
      created_at: this.#iso(),
    });
    this.#write(db);
  }

  async insertReply(
    id: string,
    verdict: Verdict,
    message: string,
  ): Promise<void> {
    const uid = this.#uid();
    const db = this.#read();
    const c = db.consultations.find((x) => x.id === id);
    // replies_answer: 返事待ちの相談に、active なペアの子だけが返せる。
    if (
      !c ||
      c.status !== "waiting" ||
      this.#myRoleIn(db, c.pair_id, uid) !== "child"
    )
      throw new FakeDbError("42501", "row-level security: replies_answer");
    if (!Object.prototype.hasOwnProperty.call(VERDICTS, verdict))
      throw new FakeDbError("23514", "verdict check");
    // アプリ側の規則（trim は改行・全角空白も削り、長さは UTF-16 の単位）。DB の check より厳しい。
    const len = message.trim().length;
    if (len < 1 || len > MAX_REPLY_LENGTH)
      throw new FakeDbError("23514", "message check");
    if (db.replies.some((r) => r.consultation_id === id))
      throw new FakeDbError("23505", "reply exists");
    db.replies.push({
      id: this.#newId(),
      consultation_id: id,
      replied_by: uid,
      verdict,
      message,
      created_at: this.#iso(),
    });
    // on_reply_inserted と同じ: 同じ書き込みで answered にする。
    c.status = "answered";
    this.#write(db);
  }

  async markSeen(id: string): Promise<void> {
    const uid = this.#uid();
    const db = this.#read();
    const c = db.consultations.find((x) => x.id === id);
    // cons_seen: 親が、答えのある相談にだけ書ける（当たらなければ 0 行で何も起きない）。
    if (
      !c ||
      c.status !== "answered" ||
      this.#myRoleIn(db, c.pair_id, uid) !== "parent"
    )
      return;
    c.parent_seen_at = this.#iso();
    this.#write(db);
  }

  // ---- 通知のトークン ----

  // 前の利用者の行が残っていても持ち主を上書きする（本物の register_push_token と同じ）。
  async upsertPushToken(token: string): Promise<void> {
    this.#pushTokens.set(token, this.#uid());
  }

  // テスト用: 保存されているトークンとその持ち主。
  pushTokens(): ReadonlyMap<string, string> {
    return new Map(this.#pushTokens);
  }

  // ---- 購読 ----

  subscribePair(pairId: string, onChange: (e: PairChange) => void): () => void {
    // 前の見え方を覚えておき、変わった相談とペアだけを知らせる。
    const snapshot = () => {
      const db = this.#read();
      const pair = JSON.stringify(
        db.pairs.find((p) => p.id === pairId) ?? null,
      );
      const rows = new Map<string, string>();
      for (const c of db.consultations) {
        if (c.pair_id !== pairId) continue;
        const r = db.replies.find((x) => x.consultation_id === c.id);
        rows.set(c.id, JSON.stringify([c, r ?? null]));
      }
      return { pair, rows };
    };
    let prev = snapshot();
    const check = () => {
      const next = snapshot();
      if (next.pair !== prev.pair) onChange({ kind: "pair" });
      for (const [id, json] of next.rows) {
        if (prev.rows.get(id) !== json) onChange({ kind: "consultation", id });
      }
      prev = next;
    };
    this.#localListeners.add(check);
    const stopExternal = this.#storage.onExternalChange(check);
    // Supabase の購読がつながったときと同じく、最初に 1 回取り直しを促す。
    queueMicrotask(() => onChange({ kind: "resync" }));
    return () => {
      this.#localListeners.delete(check);
      stopExternal();
    };
  }
}
