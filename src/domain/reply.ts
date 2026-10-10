// 子の返信の入力に関する規則。
// 純関数だけを置く（React・React Native に依存せず、型は import type だけで読む）。

import type { Verdict } from "../types";

// 自由入力の返信の上限。親の答えの画面で読み切れる長さに抑える。
export const MAX_REPLY_LENGTH = 200;

// 自由入力の返信を送れない理由（画面に出す順）。空なら送れる。
export function freeReplyErrors(
  text: string,
  verdict: Verdict | null,
): string[] {
  const errors: string[] = [];
  if (!text.trim()) errors.push("返信の文面を入力してください");
  if (!verdict) errors.push("判定を選んでください");
  return errors;
}
