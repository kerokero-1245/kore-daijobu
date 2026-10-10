import type { Verdict } from "./types";

// 相談相手（子）の表示名。仮の名前で、ペアリング実装で置き換える。
export const CHILD_NAME = "たろう";

// 子がタップで返信できる定型文。
export const REPLY_TEMPLATES: { verdict: Verdict; message: string }[] = [
  { verdict: "danger", message: "それ詐欺かも！絶対に対応しないで" },
  { verdict: "unsure", message: "一旦電話を切って。あとでかけ直すね" },
  { verdict: "safe", message: "大丈夫、それは本物だよ" },
];

// 判定ごとの表示情報（1 か所）。Record なので、判定を足したときの書き漏れを型が検出する。
// 色は theme.ts の verdictColor が持つ。
export const VERDICT_META: Record<
  Verdict,
  { label: string; headline: string }
> = {
  danger: { label: "詐欺かも", headline: "⚠️ 詐欺かもしれません" },
  safe: { label: "大丈夫そう", headline: "✅ 大丈夫そうです" },
  unsure: { label: "まだ分からない", headline: "🟡 いったん待って" },
};

// 自由入力で返信するとき、子が選ぶ判定の表示順。
export const VERDICT_ORDER: Verdict[] = ["danger", "safe", "unsure"];
