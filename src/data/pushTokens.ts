// プッシュ通知のアプリ側: トークンを取って保存し、通知を押したら相談を開く。
// 動くのは開発ビルド（と本番のビルド）の実機だけ。Expo Go・Web・シミュレータでは何もしない
// （判定は src/domain/push.ts の canRegisterPush。Expo Go は SDK 53 以降プッシュを扱えない）。
// 送る側は supabase/functions/notify（DB Webhook → Edge Function → Expo Push）。

import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import type { Backend } from "./backend";
import {
  canRegisterPush,
  consultationIdFromData,
  routeForNotification,
  type PushRoute,
} from "../domain/push";
import type { Role } from "../domain/pairing";

function pushSupported(): boolean {
  return canRegisterPush({
    os: Platform.OS,
    isDevice: Device.isDevice,
    // appOwnership は非推奨だが、Expo Go と開発ビルドを分けられるのはこれだけ
    // （executionEnvironment の storeClient はどちらでも同じ値）。
    appOwnership: Constants.appOwnership ?? null,
    executionEnvironment: Constants.executionEnvironment ?? null,
  });
}

// EAS の projectId（app.json の extra.eas.projectId。無ければ EAS が入れる easConfig）。
function projectIdOf(): string | null {
  const extra: unknown = Constants.expoConfig?.extra;
  const eas: unknown =
    typeof extra === "object" && extra !== null
      ? (extra as Record<string, unknown>).eas
      : null;
  const fromExtra: unknown =
    typeof eas === "object" && eas !== null
      ? (eas as Record<string, unknown>).projectId
      : null;
  if (typeof fromExtra === "string" && fromExtra) return fromExtra;
  const fromEas = Constants.easConfig?.projectId;
  return typeof fromEas === "string" && fromEas ? fromEas : null;
}

let warnedNoProjectId = false;

// 許可を確かめ（未許可なら尋ね）、トークンを取って push_tokens に保存する。起動のたびに呼ぶ
// （トークンは変わりうるので、毎回 upsert して disabled_at を null に戻す）。
export async function registerPushToken(backend: Backend): Promise<void> {
  if (!pushSupported()) return;
  if (Platform.OS === "android") {
    // Android 13 以降は、チャンネルが 1 つも無いと許可を尋ねられない。
    await Notifications.setNotificationChannelAsync("default", {
      name: "相談と返事",
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted")
    ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== "granted") return;
  const projectId = projectIdOf();
  if (!projectId) {
    if (!warnedNoProjectId) {
      warnedNoProjectId = true;
      console.warn(
        "EAS の projectId が無いので、通知のトークンを取りません（README の「プッシュ通知の準備」）。",
      );
    }
    return;
  }
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  await backend.upsertPushToken(data);
}

// つながったあと（paired）に呼ぶ。トークンを保存し、通知を押したら相談の画面を開く。
// アプリが閉じていて通知から起動したときは、最後に押された通知を 1 回だけ読む。
export function usePushNotifications(
  backend: Backend | null,
  paired: { role: Role; pairId: string } | null,
  navigate: (route: PushRoute) => void,
): void {
  const role = paired?.role ?? null;
  const pairId = paired?.pairId ?? null;

  useEffect(() => {
    if (!backend || !pairId || !pushSupported()) return;
    registerPushToken(backend).catch((e: unknown) =>
      console.warn("通知のトークンを保存できませんでした", e),
    );
  }, [backend, pairId]);

  useEffect(() => {
    if (!role || !pushSupported()) return;
    const open = (response: Notifications.NotificationResponse) => {
      const id = consultationIdFromData(
        response.notification.request.content.data,
      );
      if (id) navigate(routeForNotification(role, id));
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      Notifications.clearLastNotificationResponse();
      open(last);
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [role, navigate]);
}
