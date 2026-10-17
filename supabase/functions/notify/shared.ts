// 生成物。手で直さず `npm run gen:notify` で作り直す（src の正本から作る）。
// Edge Function が読む値の写し。Deno のデプロイは functions の外を束ねる保証が無いので、ここに置く。

// アプリ名（通知の件名）。
export const APP_NAME = "これ、大丈夫？";

// 通知の data に入れる相談の id の名前（受ける側のアプリと同じ）。
export const PUSH_DATA_KEY = "consultationId";

// 相談の種類ごとの表示名（通知の本文に使う）。
export const CATEGORY_META = {
  construction: { label: "点検・工事・リフォーム" },
  impersonation: { label: "家族や役所を名乗る電話" },
  money: { label: "お金の話" },
  other: { label: "その他" },
  refund: { label: "還付金・税金" },
} as const;
