// 相談の種類（category）の表示情報。
// 純関数とデータだけを置く（React・React Native に依存せず、型は import type だけで読む）。

import type { Category } from "../types";

// 親が選ぶ相談の種類（表示順）。
export const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: "money", label: "お金の話", emoji: "💰" },
  { key: "refund", label: "還付金・税金", emoji: "🏦" },
  { key: "construction", label: "点検・工事・リフォーム", emoji: "🔧" },
  { key: "impersonation", label: "家族や役所を名乗る電話", emoji: "📞" },
  { key: "other", label: "その他", emoji: "❓" },
];

export function categoryLabel(key: Category): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "その他";
}

export function categoryEmoji(key: Category): string {
  return CATEGORIES.find((c) => c.key === key)?.emoji ?? "❓";
}
