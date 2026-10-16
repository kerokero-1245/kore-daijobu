// supabase-js で Backend を実装する。client は引数で受ける（テストでは呼び出しを記録する偽物を渡す）。
// 権限の検査は DB の RLS と関数（supabase/migrations/）が担い、ここは表・関数を呼ぶだけ。
// React・React Native に依存しない。

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Consultation, Verdict } from "../types";
import type {
  Backend,
  Invite,
  NewConsultationRow,
  PairChange,
  RedeemResult,
} from "./backend";
import { toRedeemReason, type PairInfo, type Role } from "../domain/pairing";
import { rowToConsultation } from "../domain/row";

// 相談を返信つきで読む列（replies は consultation_id が unique なので 1 件で埋め込まれる）。
export const CONSULTATION_COLUMNS =
  "id, category, photo_path, status, parent_seen_at, created_at, replies(verdict, message, created_at)";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function idOf(row: unknown): string | null {
  return isRecord(row) && typeof row.id === "string" ? row.id : null;
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what}: ${error.message}`);
}

// 一度サインインしたことがある印（端末の保存に置く。アプリでは AsyncStorage、テストではメモリ）。
export interface SignInMark {
  has(): Promise<boolean>;
  set(): Promise<void>;
  clear(): Promise<void>;
}

function memoryMark(): SignInMark {
  let marked = false;
  return {
    has: async () => marked,
    set: async () => {
      marked = true;
    },
    clear: async () => {
      marked = false;
    },
  };
}

export class SupabaseBackend implements Backend {
  #client: SupabaseClient;
  #mark: SignInMark;
  #uid: string | null = null;

  constructor(client: SupabaseClient, mark: SignInMark = memoryMark()) {
    this.#client = client;
    this.#mark = mark;
  }

  #me(): string {
    if (!this.#uid) throw new Error("signIn の前に呼ばれました");
    return this.#uid;
  }

  async signIn(): Promise<string> {
    const { data: s, error: sessionError } =
      await this.#client.auth.getSession();
    const existing = s.session?.user.id;
    if (existing) {
      this.#uid = existing;
      await this.#mark.set();
      return existing;
    }
    // 保存したセッションが読めない・更新できないときに新しい匿名ユーザーを作ると、
    // 元のペアから黙って外れてしまう。新しく作るのは、この端末で一度もサインインしていないときだけ。
    if (sessionError) fail("getSession", sessionError);
    if (await this.#mark.has())
      throw new Error("getSession: 保存したセッションがありません");
    const { data, error } = await this.#client.auth.signInAnonymously();
    if (error) fail("signInAnonymously", error);
    const uid = data.user?.id;
    if (!uid) throw new Error("signInAnonymously: user がありません");
    this.#uid = uid;
    await this.#mark.set();
    return uid;
  }

  async signOut(): Promise<void> {
    const { error } = await this.#client.auth.signOut();
    if (error) fail("signOut", error);
    this.#uid = null;
    // 自分でサインアウトしたので、次の signIn は新しい匿名ユーザーを作ってよい。
    await this.#mark.clear();
  }

  async getRole(): Promise<Role | null> {
    const { data, error } = await this.#client
      .from("profiles")
      .select("role")
      .eq("id", this.#me())
      .maybeSingle();
    if (error) fail("profiles", error);
    const role: unknown = isRecord(data) ? data.role : null;
    return role === "parent" || role === "child" ? role : null;
  }

  async setRole(role: Role): Promise<void> {
    const { error } = await this.#client.from("profiles").insert({
      id: this.#me(),
      role,
      display_name: role === "parent" ? "親" : "子",
    });
    if (error) fail("profiles", error);
  }

  async createPair(): Promise<string> {
    const { data, error } = await this.#client
      .from("pairs")
      .insert({ child_id: this.#me() })
      .select("id")
      .single();
    if (error) fail("pairs", error);
    const id: unknown = isRecord(data) ? data.id : null;
    if (typeof id !== "string") throw new Error("pairs: id がありません");
    return id;
  }

  async createInvite(): Promise<Invite> {
    const { data, error } = await this.#client.rpc("create_invite");
    if (error) fail("create_invite", error);
    const d: unknown = data;
    const code = isRecord(d) ? d.code : null;
    const expires = isRecord(d) ? d.expires_at : null;
    const expiresAt = typeof expires === "string" ? Date.parse(expires) : NaN;
    if (typeof code !== "string" || Number.isNaN(expiresAt))
      throw new Error("create_invite: 戻り値が読めません");
    return { code, expiresAt };
  }

  async redeemInvite(code: string): Promise<RedeemResult> {
    const { data, error } = await this.#client.rpc("redeem_invite", { code });
    if (error) fail("redeem_invite", error);
    const d: unknown = data;
    const reason = toRedeemReason(isRecord(d) ? d.reason : null);
    return { ok: isRecord(d) && d.ok === true && reason === "ok", reason };
  }

  async getPair(): Promise<PairInfo | null> {
    // RLS（pairs_read）で自分が当事者の行だけが返る。
    const { data, error } = await this.#client
      .from("pairs")
      .select("id, parent_id, child_id, status")
      .limit(1)
      .maybeSingle();
    if (error) fail("pairs", error);
    if (!isRecord(data) || typeof data.id !== "string") return null;
    const status = data.status === "active" ? "active" : "pending";
    const role: Role = data.parent_id === this.#me() ? "parent" : "child";
    return { pairId: data.id, role, status };
  }

  async listConsultations(
    pairId: string,
    limit: number,
  ): Promise<Consultation[]> {
    const { data, error } = await this.#client
      .from("consultations")
      .select(CONSULTATION_COLUMNS)
      .eq("pair_id", pairId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) fail("consultations", error);
    const rows: unknown = data;
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r: unknown) => rowToConsultation(r))
      .filter((c): c is Consultation => c !== null);
  }

  async getConsultation(id: string): Promise<Consultation | null> {
    const { data, error } = await this.#client
      .from("consultations")
      .select(CONSULTATION_COLUMNS)
      .eq("id", id)
      .maybeSingle();
    if (error) fail("consultations", error);
    return rowToConsultation(data);
  }

  async insertConsultation(c: NewConsultationRow): Promise<void> {
    const { error } = await this.#client.from("consultations").insert({
      id: c.id,
      pair_id: c.pairId,
      created_by: this.#me(),
      category: c.category,
    });
    if (error) fail("consultations", error);
  }

  async insertReply(
    id: string,
    verdict: Verdict,
    message: string,
  ): Promise<void> {
    // status は返信の挿入トリガーが answered にする（アプリからは変えられない）。
    const { error } = await this.#client.from("replies").insert({
      consultation_id: id,
      replied_by: this.#me(),
      verdict,
      message,
    });
    if (error) fail("replies", error);
  }

  async markSeen(id: string): Promise<void> {
    const { error } = await this.#client
      .from("consultations")
      .update({ parent_seen_at: new Date().toISOString() })
      .eq("id", id);
    if (error) fail("consultations", error);
  }

  subscribePair(pairId: string, onChange: (e: PairChange) => void): () => void {
    const channel = this.#client
      .channel(`pair:${pairId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "consultations",
          filter: `pair_id=eq.${pairId}`,
        },
        (payload) => {
          const id = idOf(payload.new) ?? idOf(payload.old);
          if (id) onChange({ kind: "consultation", id });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pairs",
          filter: `id=eq.${pairId}`,
        },
        () => onChange({ kind: "pair" }),
      )
      .subscribe((status) => {
        // つながった（つなぎ直した）ら取りこぼしがありうるので一覧を取り直す。
        if (`${status}` === "SUBSCRIBED") onChange({ kind: "resync" });
      });
    return () => {
      void this.#client.removeChannel(channel);
    };
  }
}
