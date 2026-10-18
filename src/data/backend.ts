// 保存先（バックエンド）の窓口。画面とストアはこの interface だけを使う。
// 実装は 2 つ: SupabaseBackend（supabase-js）と FakeBackend（端末内。Supabase の設定が無いとき・テスト）。
// どちらも「自分（匿名ユーザー）」を持ち、権限の検査は DB（Fake は同じ規則の写し）が担う。

import type { Category, Consultation, Verdict } from "../types";
import type { PairInfo, RedeemReason, Role } from "../domain/pairing";

export interface Invite {
  code: string;
  expiresAt: number; // epoch ms
}

export interface RedeemResult {
  ok: boolean;
  reason: RedeemReason;
}

// 新しい相談の行。id はアプリが作って渡す（先に手元へ足すため）。
export interface NewConsultationRow {
  id: string;
  pairId: string;
  category: Category;
}

// ペアの変化の知らせ。consultation は 1 件の作成・更新、pair はペアの状態の変化、
// resync は購読がつながったとき・変更の配信が始まったとき（取りこぼしがありうるので一覧を取り直す）。
export type PairChange =
  { kind: "consultation"; id: string } | { kind: "pair" } | { kind: "resync" };

export interface Backend {
  // 匿名でサインインし（済みならそのまま）、自分の uid を返す。
  // 保存したセッションが読めないときは、新しい利用者を作らずに失敗する（Supabase 版）。
  signIn(): Promise<string>;
  // サインアウトする（「つなぎ直す」を押したとき）。次の signIn は新しい匿名ユーザーになる。
  // 先に自分の通知のトークンを外す（同じ端末の同じトークンを、次の利用者が保存できるように）。
  signOut(): Promise<void>;
  getRole(): Promise<Role | null>;
  // 役割を決める（profiles に 1 回だけ作る。あとから変えられない）。
  setRole(role: Role): Promise<void>;
  // 子が pending のペアを作り、その id を返す。
  createPair(): Promise<string>;
  // 自分が子の pending のペアを消す（番号も一緒に消え、前の番号は invalid になる）。
  // 「役割を選び直す」「つなぎ直す」でサインアウトする前に呼ぶ。つながったペア・他人のペアは消さない。
  // 親や、該当が無いときは何もしない。
  cancelPendingPair(): Promise<void>;
  // 子が 6 桁の招待を出す。同じペアの古い未使用コードは無効になる。
  createInvite(): Promise<Invite>;
  // 親の端末で招待を引き換える。失敗も例外にせず理由を返す。
  redeemInvite(code: string): Promise<RedeemResult>;
  getPair(): Promise<PairInfo | null>;
  // 最近の相談（新しい順・最大 limit 件）。
  listConsultations(pairId: string, limit: number): Promise<Consultation[]>;
  getConsultation(id: string): Promise<Consultation | null>;
  insertConsultation(c: NewConsultationRow): Promise<void>;
  insertReply(id: string, verdict: Verdict, message: string): Promise<void>;
  // 親が答えを開いた時刻を記録する。
  markSeen(id: string): Promise<void>;
  // ペアの相談とペアの状態の変化を購読する。返り値で購読をやめる。
  subscribePair(pairId: string, onChange: (e: PairChange) => void): () => void;
  // この端末の Expo の通知のトークンを自分のものとして保存する（token が主キー。disabled_at は null に戻す）。
  // 前の利用者の行が残っていても持ち主を自分に移す（トークンを持っていること＝その端末を使っていること）。
  upsertPushToken(token: string): Promise<void>;
}

// 最近の相談として取り直す件数。
export const RECENT_LIMIT = 50;
