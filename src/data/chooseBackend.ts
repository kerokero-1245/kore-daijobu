// どのバックエンドで動くかを決める純関数（backendInstance.ts が使う。node --test で固定する）。
// 本番の書き出しで設定が欠けたまま偽物で動くと「送れたように見えて届かない」ので、
// 偽物に切り替えるのは開発中（__DEV__）か、EXPO_PUBLIC_BACKEND=fake を明示したときだけ。
// それ以外で URL か anon key が欠けていれば "missing"（バックエンドを作らず、起動画面に設定が無いと出す）。

export type BackendKind = "supabase" | "fake" | "missing";

export interface BackendConfig {
  url?: string;
  anonKey?: string;
  dev: boolean;
  explicit?: string; // EXPO_PUBLIC_BACKEND の値
}

export function chooseBackend(config: BackendConfig): BackendKind {
  if (config.explicit === "fake") return "fake";
  if (config.url && config.anonKey) return "supabase";
  return config.dev ? "fake" : "missing";
}
