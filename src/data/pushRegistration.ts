// プッシュ通知のアプリ側の手順（許可 → projectId → トークン → 保存、押された通知 → 開く画面）。
// React Native・Expo に依存しない。expo-notifications と実行環境の値は引数で受ける
// （iOS / Android の pushTokens.native.ts が実物を渡す。tests/push.test.mjs が偽物で検査する）。

import type { Backend } from "./backend";
import {
  canRegisterPush,
  consultationIdFromData,
  PUSH_CHANNEL_ID,
  PUSH_CHANNEL_NAME,
  routeForNotification,
  type PushEnvironment,
  type PushRoute,
} from "../domain/push";
import type { Role } from "../domain/pairing";

// expo-notifications のうち、登録で使う分。
export interface NotificationsApi {
  getPermissionsAsync(): Promise<{ status: string }>;
  requestPermissionsAsync(): Promise<{ status: string }>;
  setNotificationChannelAsync(
    channelId: string,
    channel: { name: string; importance: number },
  ): Promise<unknown>;
  getExpoPushTokenAsync(options: {
    projectId: string;
  }): Promise<{ data: string }>;
}

export interface RegistrationDeps {
  notifications: NotificationsApi;
  env: PushEnvironment;
  // Notifications.AndroidImportance.MAX（Android のチャンネルの重要度）。
  maxImportance: number;
  projectId: string | null;
  // projectId が無いときに呼ぶ（呼ぶ側で 1 回だけにする）。
  warnNoProjectId: () => void;
  // 途中で画面の側が取り消したら true（つなぎ直しの後に前の利用者で保存しないため）。
  isCancelled?: () => boolean;
}

export type RegistrationResult =
  "unsupported" | "denied" | "no_project" | "cancelled" | "saved";

// EAS の projectId（app.json の extra.eas.projectId。無ければ EAS が入れる easConfig.projectId）。
export function projectIdFrom(
  expoConfigExtra: unknown,
  easConfigProjectId: unknown,
): string | null {
  const eas: unknown =
    typeof expoConfigExtra === "object" && expoConfigExtra !== null
      ? (expoConfigExtra as Record<string, unknown>).eas
      : null;
  const fromExtra: unknown =
    typeof eas === "object" && eas !== null
      ? (eas as Record<string, unknown>).projectId
      : null;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra;
  return typeof easConfigProjectId === "string" && easConfigProjectId
    ? easConfigProjectId
    : null;
}

// 許可を確かめ（未許可なら尋ね）、トークンを取って保存する。起動のたびに呼ぶ
// （トークンは変わりうるので、毎回保存して disabled_at を null に戻す）。
export async function registerPushTokenWith(
  deps: RegistrationDeps,
  backend: Pick<Backend, "upsertPushToken">,
): Promise<RegistrationResult> {
  if (!canRegisterPush(deps.env)) return "unsupported";
  const cancelled = () => deps.isCancelled?.() === true;
  const n = deps.notifications;
  if (deps.env.os === "android") {
    // Android 13 以降は、チャンネルが 1 つも無いと許可を尋ねられない。
    await n.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: PUSH_CHANNEL_NAME,
      importance: deps.maxImportance,
    });
  }
  let { status } = await n.getPermissionsAsync();
  if (status !== "granted" && !cancelled())
    ({ status } = await n.requestPermissionsAsync());
  if (cancelled()) return "cancelled";
  if (status !== "granted") return "denied";
  if (!deps.projectId) {
    deps.warnNoProjectId();
    return "no_project";
  }
  const { data } = await n.getExpoPushTokenAsync({
    projectId: deps.projectId,
  });
  if (cancelled()) return "cancelled";
  await backend.upsertPushToken(data);
  return "saved";
}

// 押された通知（expo-notifications の NotificationResponse のうち、使う分）。
export interface NotificationResponseLike {
  notification: { request: { content: { data?: unknown } } };
}

// 押された通知から開く画面を決める（data に相談の id が無ければ null）。
export function routeForResponse(
  role: Role,
  response: NotificationResponseLike,
): PushRoute | null {
  const id = consultationIdFromData(response.notification.request.content.data);
  return id ? routeForNotification(role, id) : null;
}

// 押された通知を開く。開く画面が無い通知は何もしない。
export function openResponse(
  role: Role,
  response: NotificationResponseLike,
  navigate: (route: PushRoute) => void,
): void {
  const route = routeForResponse(role, response);
  if (route) navigate(route);
}

// アプリが閉じていて通知から起動したとき、最後に押された通知を 1 回だけ読んで開く。
export function openLastResponse(
  api: {
    getLastNotificationResponse(): NotificationResponseLike | null;
    clearLastNotificationResponse(): void;
  },
  role: Role,
  navigate: (route: PushRoute) => void,
): void {
  const last = api.getLastNotificationResponse();
  if (!last) return;
  api.clearLastNotificationResponse();
  openResponse(role, last, navigate);
}
