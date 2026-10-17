// 通知の Edge Function が読む値の写し（supabase/functions/notify/shared.ts）を、src の正本から作る。
// Deno のデプロイが supabase/functions の外のファイルを束ねる保証が無いので、Function は外を import しない。
// 値の正本は src のまま 1 か所に保ち、Function の側にはこのスクリプトが書く写しだけを置く。
// 使い方: npm run gen:notify（種類の名前・アプリ名・通知の data の名前・チャンネルを変えたら打つ）。
// 写しが正本と一致することは tests/notify-shared.test.mjs が確かめる（打ち忘れると落ちる）。
// 出力は決定的（キーは文字コードの順・末尾の改行は 1 つ）で、Prettier の整形のままの形にする。
import "../tests/ts-resolve.mjs";

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SHARED_PATH = fileURLToPath(
  new URL("../supabase/functions/notify/shared.ts", import.meta.url),
);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// 写しの中身（文字列）を返す。書き込みはしない（テストからも呼ぶ）。
export async function renderShared() {
  const { CATEGORY_META } = await import("../src/domain/category.ts");
  const { APP_NAME } = await import("../src/constants.ts");
  const { PUSH_CHANNEL_ID, PUSH_DATA_KEY } =
    await import("../src/domain/push.ts");

  const keys = Object.keys(CATEGORY_META).sort();
  if (keys.length === 0) throw new Error("CATEGORY_META が空です");
  for (const key of keys) {
    if (!IDENTIFIER.test(key))
      throw new Error(`種類のキーが識別子の形ではありません: ${key}`);
    if (typeof CATEGORY_META[key].label !== "string")
      throw new Error(`種類のラベルが文字列ではありません: ${key}`);
  }
  for (const [name, value] of [
    ["APP_NAME", APP_NAME],
    ["PUSH_DATA_KEY", PUSH_DATA_KEY],
    ["PUSH_CHANNEL_ID", PUSH_CHANNEL_ID],
  ]) {
    if (typeof value !== "string")
      throw new Error(`${name} が文字列ではありません`);
  }

  const lines = [
    "// 生成物。手で直さず `npm run gen:notify` で作り直す（src の正本から作る）。",
    "// Edge Function が読む値の写し。Deno のデプロイは functions の外を束ねる保証が無いので、ここに置く。",
    "",
    "// アプリ名（通知の件名）。",
    `export const APP_NAME = ${JSON.stringify(APP_NAME)};`,
    "",
    "// 通知の data に入れる相談の id の名前（受ける側のアプリと同じ）。",
    `export const PUSH_DATA_KEY = ${JSON.stringify(PUSH_DATA_KEY)};`,
    "",
    "// Android の通知チャンネル（アプリが作るものと同じ名前）。",
    `export const PUSH_CHANNEL_ID = ${JSON.stringify(PUSH_CHANNEL_ID)};`,
    "",
    "// 相談の種類ごとの表示名（通知の本文に使う）。",
    "export const CATEGORY_META = {",
    ...keys.map(
      (key) =>
        `  ${key}: { label: ${JSON.stringify(CATEGORY_META[key].label)} },`,
    ),
    "} as const;",
  ];
  return `${lines.join("\n")}\n`;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  writeFileSync(SHARED_PATH, await renderShared());
  console.log(`書きました: ${SHARED_PATH}`);
}
