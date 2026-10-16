// プッシュ通知の純関数（アプリと Edge Function の両方から読む）。
// React・React Native・Expo・Deno に依存しない。import も置かない（Deno の入口からも、そのまま読めるように）。

// 通知の data に入れる相談の id の名前（送る側 supabase/functions/notify/core.ts と、受ける側のアプリで共有）。
export const PUSH_DATA_KEY = "consultationId";

// トークンを取ってよい環境か。開発ビルド（と本番のビルド）の実機だけ。
// - Web は expo-notifications の対応先に無い。シミュレータ・エミュレータは扱わない（isDevice が false）
// - Expo Go は SDK 53 以降プッシュを扱えない。executionEnvironment の storeClient は
//   「Expo Go か expo-dev-client の開発ビルド」なので、Expo Go かどうかは appOwnership === "expo" で分ける
export interface PushEnvironment {
  os: string; // Platform.OS
  isDevice: boolean; // expo-device の isDevice
  appOwnership: string | null; // expo-constants の appOwnership（Expo Go なら "expo"）
  executionEnvironment: string | null; // expo-constants の executionEnvironment
}

export function canRegisterPush(env: PushEnvironment): boolean {
  if (env.os !== "ios" && env.os !== "android") return false;
  if (!env.isDevice) return false;
  const expoGo =
    env.executionEnvironment === "storeClient" && env.appOwnership === "expo";
  return !expoGo;
}

// 通知の data から相談の id を取り出す（外から来る値なので unknown で受ける）。
export function consultationIdFromData(data: unknown): string | null {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return null;
  const id: unknown = (data as Record<string, unknown>)[PUSH_DATA_KEY];
  return typeof id === "string" && id.length > 0 ? id : null;
}

// 通知を押したときに開く画面。親は答えの画面、子は相談の詳細。
export type PushRoute =
  | { name: "ParentStatus"; params: { consultationId: string } }
  | { name: "ConsultationDetail"; params: { consultationId: string } };

export function routeForNotification(
  role: "parent" | "child",
  consultationId: string,
): PushRoute {
  return role === "parent"
    ? { name: "ParentStatus", params: { consultationId } }
    : { name: "ConsultationDetail", params: { consultationId } };
}
