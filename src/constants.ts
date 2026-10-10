import type { Verdict } from "./types";

// 相談相手（子）の表示名。仮の名前で、ペアリング実装で置き換える。
export const CHILD_NAME = "たろう";

// 子がタップで返信できる定型文。
export const REPLY_TEMPLATES: { verdict: Verdict; message: string }[] = [
  { verdict: "danger", message: "それ詐欺かも！絶対に対応しないで" },
  { verdict: "unsure", message: "一旦電話を切って。あとでかけ直すね" },
  { verdict: "safe", message: "大丈夫、それは本物だよ" },
];

// 自由入力で返信するとき、子が選ぶ判定の名前（表示順）。
export const VERDICT_CHOICES: { verdict: Verdict; label: string }[] = [
  { verdict: "danger", label: "詐欺かも" },
  { verdict: "safe", label: "大丈夫そう" },
  { verdict: "unsure", label: "まだ分からない" },
];

// 判定ごとの見出し（親の答え画面で使う）。
export const VERDICT_HEADLINE: Record<Verdict, string> = {
  danger: "⚠️ 詐欺かもしれません",
  unsure: "🟡 いったん待って",
  safe: "✅ 大丈夫そうです",
};
