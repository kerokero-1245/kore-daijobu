// ESLint の設定（flat config）。Expo の設定（eslint-config-expo）を使い、規則の追加・無効化はしない。
import { defineConfig, globalIgnores } from "eslint/config";
// 拡張子なしの "eslint-config-expo/flat" は、同名のフォルダ flat/ があるので ESM からは読めない。
import expoConfig from "eslint-config-expo/flat.js";
import { createRequire } from "node:module";

// eslint-config-expo は React の版を "detect" にしている。eslint-plugin-react 7.37 の detect は
// ESLint 10 で消えた context.getFilename() を呼んで落ちるので、入っている react の版を渡す。
const reactVersion = createRequire(import.meta.url)(
  "react/package.json",
).version;

export default defineConfig([
  expoConfig,
  { settings: { react: { version: reactVersion } } },
  // 依存・生成物・書き出し先は検査しない（.prettierignore の同名の項目と同じ）。
  globalIgnores([
    "node_modules/",
    "dist/",
    ".expo/",
    "web-build/",
    "ios/",
    "android/",
    "expo-env.d.ts",
  ]),
]);
