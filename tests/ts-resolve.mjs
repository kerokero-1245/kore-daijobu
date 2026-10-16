// テストから src/ の .ts を読むための解決の補い（node --test のテストファイルが最初に import する）。
// src/ のファイルは Metro と tsc の作法で、拡張子なし（"../domain/row"）で互いを import する。
// Node はそれを解決できないので、相対パスで見つからなかったときだけ ".ts" を付けて探し直す。
// 静的 import はこのフックより先に解決されるので、フックを使うテストは src を動的 import で読む。
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      const relative =
        specifier.startsWith("./") || specifier.startsWith("../");
      if (!relative || e?.code !== "ERR_MODULE_NOT_FOUND") throw e;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
