// 相談の種類（category）の表示情報。
// 純関数とデータだけを置く（React・React Native に依存せず、型は import type だけで読む）。

import type { Category, IconName } from "../types";

// 種類ごとの表示情報（1 か所）。Record なので、種類を足したときの書き漏れを型が検出する。
export const CATEGORY_META: Record<
  Category,
  { label: string; icon: IconName }
> = {
  money: { label: "お金の話", icon: "cat-money" },
  refund: { label: "還付金・税金", icon: "cat-refund" },
  construction: { label: "点検・工事・リフォーム", icon: "cat-construction" },
  impersonation: { label: "家族や役所を名乗る電話", icon: "cat-impersonation" },
  other: { label: "その他", icon: "cat-other" },
};

// 親が選ぶ相談の種類の表示順。
export const CATEGORY_ORDER: Category[] = [
  "money",
  "refund",
  "construction",
  "impersonation",
  "other",
];

// 親が選ぶ相談の種類（表示順）。
export const CATEGORIES: { key: Category; label: string; icon: IconName }[] =
  CATEGORY_ORDER.map((key) => ({ key, ...CATEGORY_META[key] }));

// 表に無い値は other に寄せる（新しい種類を古いアプリが受けたとき落とさない）。
function metaOf(key: Category): { label: string; icon: IconName } {
  return CATEGORY_META[key] ?? CATEGORY_META.other;
}

export function categoryLabel(key: Category): string {
  return metaOf(key).label;
}

// 種類の絵の名前（src/components/icons/Icon.tsx）。
export function categoryIcon(key: Category): IconName {
  return metaOf(key).icon;
}
