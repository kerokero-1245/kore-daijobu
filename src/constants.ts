import type { IconName, Verdict } from "./types";

// 名前に敬称を付けた呼び名。親の画面に子の名前を出すときは、この形にそろえる。
export function callName(name: string): string {
  return `${name} さん`;
}

// 相談相手（子）の名前。仮の名前で、ペアリング実装で置き換える。
const CHILD_NAME = "たろう";

// 親の画面に出す、子の呼び名。ペアリング実装では、ペアの相手の名前から callName で作る。
export const CHILD_CALL_NAME = callName(CHILD_NAME);

// アプリ名（親ホームの大ボタンの名前でもある）。app.json の name（ホーム画面の名前）は別。
const APP_NAME_LINES = ["これ、", "大丈夫？"];
export const APP_NAME = APP_NAME_LINES.join("");
// 大ボタンに入れるときの形（改行の位置を決めている）。
export const APP_NAME_TWO_LINES = APP_NAME_LINES.join("\n");

// 子がタップで返信できる定型文。
export const REPLY_TEMPLATES: { verdict: Verdict; message: string }[] = [
  { verdict: "danger", message: "それ詐欺かも！絶対に対応しないで" },
  { verdict: "unsure", message: "一旦電話を切って。あとでかけ直すね" },
  { verdict: "safe", message: "大丈夫、それは本物だよ" },
];

// 判定ごとの表示情報（1 か所）。Record なので、判定を足したときの書き漏れを型が検出する。
// 色は theme.ts の verdictColor が持つ。見出しの前の印は絵（icon）で出す（絵文字は使わない）。
export const VERDICT_META: Record<
  Verdict,
  { label: string; headline: string; icon: IconName }
> = {
  danger: {
    label: "詐欺かも",
    headline: "詐欺かもしれません",
    icon: "verdict-danger",
  },
  safe: {
    label: "大丈夫そう",
    headline: "大丈夫そうです",
    icon: "verdict-safe",
  },
  unsure: {
    label: "まだ分からない",
    headline: "いったん待って",
    icon: "verdict-unsure",
  },
};

// 自由入力で返信するとき、子が選ぶ判定の表示順。
export const VERDICT_ORDER: Verdict[] = ["danger", "safe", "unsure"];
