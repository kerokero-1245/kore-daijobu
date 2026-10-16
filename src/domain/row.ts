// DB の行（consultations に replies を埋め込んだ形）をアプリの Consultation に読み替える。
// 外から来る値なので unknown で受けて中で絞る。status と返信の組が合わない行・読めない値の行は null にして捨てる
// （DB でもトリガーと unique で作れない組だが、画面の判別共用体を壊さないよう読む側でも守る）。
// 純関数だけを置く（React・React Native・supabase-js に依存しない）。

import type { Category, Consultation, Reply, Verdict } from "../types";

// 型の全値を持つ表。種類や判定を足すと、ここの書き漏れを型が検出する。
const KNOWN_CATEGORY: Record<Category, true> = {
  money: true,
  refund: true,
  construction: true,
  impersonation: true,
  other: true,
};
const KNOWN_VERDICT: Record<Verdict, true> = {
  danger: true,
  safe: true,
  unsure: true,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCategory(v: string): v is Category {
  return Object.prototype.hasOwnProperty.call(KNOWN_CATEGORY, v);
}

function isVerdict(v: unknown): v is Verdict {
  return (
    typeof v === "string" &&
    Object.prototype.hasOwnProperty.call(KNOWN_VERDICT, v)
  );
}

// timestamptz の文字列（ISO 8601）を epoch ms に。読めなければ null。
function toEpoch(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

// 返信の埋め込み。1 対 1 なら 1 件のオブジェクト、配列で来ても 0〜1 件として読む。
// 無ければ undefined、あるのに読めなければ null。
function readReply(v: unknown): Reply | undefined | null {
  if (v === null || v === undefined) return undefined;
  let one: unknown = v;
  if (Array.isArray(v)) {
    if (v.length === 0) return undefined;
    if (v.length > 1) return null; // 1 相談 1 返信（unique）に反する
    one = v[0];
  }
  if (!isRecord(one)) return null;
  const createdAt = toEpoch(one.created_at);
  if (!isVerdict(one.verdict) || typeof one.message !== "string") return null;
  if (createdAt === null) return null;
  return { verdict: one.verdict, message: one.message, createdAt };
}

export function rowToConsultation(row: unknown): Consultation | null {
  if (!isRecord(row)) return null;
  const { id, category, status, photo_path } = row;
  if (typeof id !== "string" || id === "") return null;
  if (typeof category !== "string") return null;
  const createdAt = toEpoch(row.created_at);
  if (createdAt === null) return null;
  if (
    photo_path !== null &&
    photo_path !== undefined &&
    typeof photo_path !== "string"
  )
    return null;

  const base = {
    id,
    // 表に無い種類は other に寄せる（新しい種類を古いアプリが受けても落とさない）。
    category: isCategory(category) ? category : ("other" as const),
    photoUri: typeof photo_path === "string" ? photo_path : undefined,
    createdAt,
  };

  const seen = row.parent_seen_at;
  const parentSeenAt =
    seen === null || seen === undefined ? undefined : toEpoch(seen);
  if (parentSeenAt === null) return null;

  const reply = readReply(row.replies);
  if (reply === null) return null;

  if (status === "waiting") {
    // 返事待ちなのに返信がある・開いた時刻がある行は捨てる。
    if (reply || parentSeenAt !== undefined) return null;
    return { ...base, status: "waiting" };
  }
  if (status === "answered") {
    if (!reply) return null;
    return {
      ...base,
      status: "answered",
      reply,
      ...(parentSeenAt === undefined ? {} : { parentSeenAt }),
    };
  }
  return null;
}
