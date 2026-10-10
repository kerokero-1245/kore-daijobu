// 相談（Consultation）の判定・並べ替え・更新。
// 純関数だけを置く。React・React Native・画面に依存せず、型は import type だけで読むので、
// Node から直接読んでテストできる（tests/）。Supabase に移したあとも、サーバ側の検査と同じ規則を共有する場所にする。

import type {
  AnsweredConsultation,
  Category,
  Consultation,
  Reply,
  Verdict,
  WaitingConsultation,
} from "../types";

// 親ホームに出す相談の入口は最大 3 件。
export const MAX_ENTRIES = 3;

// 子が答えた（返信が付いている）相談か。true のとき型の上でも reply を取り出せる。
export function isAnswered(c: Consultation): c is AnsweredConsultation {
  return c.status === "answered";
}

// 返信が付いていればその返信、返事待ちなら undefined。
export function answeredReply(c: Consultation): Reply | undefined {
  return isAnswered(c) ? c.reply : undefined;
}

// 答えが届いて、親がまだ開いていない相談か。
export function isUnseenAnswer(c: Consultation): boolean {
  return isAnswered(c) && !c.parentSeenAt;
}

// 親ホームに出す入口の種類。
type EntryKind = "unseenAnswer" | "waiting" | "seenAnswer";

// 親ホームでの並び順（小さいほど先）: 答えが届いて親がまだ開いていないもの → 返事待ち → 開いたことのある答え。
const ENTRY_RANK: Record<EntryKind, number> = {
  unseenAnswer: 0,
  waiting: 1,
  seenAnswer: 2,
};

export function entryKind(c: Consultation): EntryKind {
  if (isUnseenAnswer(c)) return "unseenAnswer";
  return isAnswered(c) ? "seenAnswer" : "waiting";
}

export function entryRank(c: Consultation): number {
  return ENTRY_RANK[entryKind(c)];
}

// 親ホームに出す相談（並び順どおり・最大 MAX_ENTRIES 件）。同じ種類の中は新しい順。元の配列は変えない。
export function pickEntries(consultations: Consultation[]): Consultation[] {
  return [...consultations]
    .sort((a, b) => entryRank(a) - entryRank(b) || b.createdAt - a.createdAt)
    .slice(0, MAX_ENTRIES);
}

const ENTRY_LABEL: Record<EntryKind, { emoji: string; label: string }> = {
  unseenAnswer: { emoji: "📩", label: "答えが届きました" },
  waiting: { emoji: "⏳", label: "返事を待っています" },
  seenAnswer: { emoji: "✔️", label: "確認ずみの答え" },
};

// 親ホームの入口に出す絵文字と文言。
export function entryLabel(c: Consultation): { emoji: string; label: string } {
  return ENTRY_LABEL[entryKind(c)];
}

// 新しい相談（返事待ち）。キーは id / category / photoUri / status / createdAt の 5 つで、
// photoUri は渡されなくてもキーを持つ（Supabase に移すときの行の形の前提）。
export function newConsultation(
  id: string,
  category: Category,
  photoUri: string | undefined,
  now: number,
): WaitingConsultation {
  return { id, category, photoUri, status: "waiting", createdAt: now };
}

// id の相談に返信を付けて「返信済み」にする。元の配列は変えない。
// 該当する相談が無いときは同じ配列をそのまま返す。
export function applyReply(
  consultations: Consultation[],
  id: string,
  verdict: Verdict,
  message: string,
  now: number,
): Consultation[] {
  if (!consultations.some((c) => c.id === id)) return consultations;
  return consultations.map((c) =>
    c.id === id
      ? {
          ...c,
          status: "answered",
          reply: { verdict, message, createdAt: now },
        }
      : c,
  );
}

// 親が答えを開いたことを記録する（parentSeenAt に時刻を入れる）。元の配列は変えない。
// 該当する相談が無い・まだ答えが無い・すでに記録済みのときは、同じ配列をそのまま返す（変化なし）。
export function recordAnswerSeen(
  consultations: Consultation[],
  id: string,
  now: number,
): Consultation[] {
  const target = consultations.find((c) => c.id === id);
  if (!target || !isUnseenAnswer(target)) return consultations;
  return consultations.map((c) =>
    c.id === id ? { ...c, parentSeenAt: now } : c,
  );
}
