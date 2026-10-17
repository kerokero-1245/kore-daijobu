// 通知の Edge Function が読む値の写し（supabase/functions/notify/shared.ts）を固定するテスト。
// 守るもの:
//   - 写しは scripts/gen-notify-shared.mjs の出力そのもの（src の正本を変えて `npm run gen:notify` を
//     打ち忘れた、写しを手で直した、のどちらもここで止める）
//   - 写しの種類の名前・アプリ名・data の名前が src の正本と全件一致する（表から動的に列挙・0 件なら失敗）
//   - Function のフォルダの .ts は、フォルダの外を相対パスで import しない
//     （Deno のデプロイが functions の外を束ねる保証が無いため）
import "./ts-resolve.mjs";

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const { SHARED_PATH, renderShared } =
  await import("../scripts/gen-notify-shared.mjs");
const shared = await import("../supabase/functions/notify/shared.ts");
const { CATEGORY_META } = await import("../src/domain/category.ts");
const { APP_NAME } = await import("../src/constants.ts");
const { PUSH_CHANNEL_ID, PUSH_DATA_KEY } =
  await import("../src/domain/push.ts");

const FUNCTION_DIR = fileURLToPath(
  new URL("../supabase/functions/notify/", import.meta.url),
);

test("shared.ts は生成スクリプトの出力と同じ（打ち忘れ・手での直しを止める）", async () => {
  const expected = await renderShared();
  const actual = readFileSync(SHARED_PATH, "utf8");
  assert.equal(
    actual,
    expected,
    "shared.ts が src の正本とずれています。`npm run gen:notify` を打ってください",
  );
});

test("shared.ts の種類の名前が src の CATEGORY_META と全件一致する（表から動的に列挙・0 件なら失敗）", () => {
  const keys = Object.keys(CATEGORY_META);
  assert.ok(keys.length > 0, "CATEGORY_META が空です");
  assert.deepEqual(
    Object.keys(shared.CATEGORY_META).sort(),
    [...keys].sort(),
    "種類のキーの集合が違います",
  );
  for (const key of keys) {
    assert.equal(
      shared.CATEGORY_META[key].label,
      CATEGORY_META[key].label,
      `種類 ${key} の名前が違います`,
    );
  }
});

test("shared.ts のアプリ名・data の名前・チャンネルが src と同じ", () => {
  assert.equal(shared.APP_NAME, APP_NAME);
  assert.equal(shared.PUSH_DATA_KEY, PUSH_DATA_KEY);
  assert.equal(shared.PUSH_CHANNEL_ID, PUSH_CHANNEL_ID);
});

// import の指定子を拾う: `import x from "…"`・`export … from "…"`・from なしの `import "…"`・動的な `import("…")`。
const IMPORT =
  /(?:\bimport\s*\(\s*|\b(?:import|export)\b[^"'();]*?\bfrom\s*|\bimport\s+)["']([^"']+)["']/g;
const specifiersOf = (text) => [...text.matchAll(IMPORT)].map((m) => m[1]);

test("import の拾い方: from つき・from なし・動的・export from を全部拾う", () => {
  assert.deepEqual(
    specifiersOf(
      [
        'import { a } from "./a.ts";',
        'import type { B } from "../b.ts";',
        'import "../c.ts";',
        'const d = await import("../d.ts");',
        'export { e } from "./e.ts";',
        'export * from "../f.ts";',
      ].join("\n"),
    ),
    ["./a.ts", "../b.ts", "../c.ts", "../d.ts", "./e.ts", "../f.ts"],
  );
});

test("Function のフォルダの .ts はフォルダの外を import しない（ファイルを動的に列挙・0 件なら失敗）", () => {
  const files = readdirSync(FUNCTION_DIR).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length > 0, "Function のフォルダに .ts がありません");
  for (const file of files) {
    const text = readFileSync(join(FUNCTION_DIR, file), "utf8");
    for (const specifier of specifiersOf(text)) {
      if (!specifier.startsWith(".")) continue;
      const target = resolve(dirname(join(FUNCTION_DIR, file)), specifier);
      const rel = relative(FUNCTION_DIR, target);
      assert.ok(
        !rel.startsWith("..") && !rel.startsWith("/"),
        `${file} がフォルダの外を import しています: ${specifier}`,
      );
    }
  }
});
