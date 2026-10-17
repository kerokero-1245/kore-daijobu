// プッシュ通知のアプリ側: トークンを取って保存し、通知を押したら相談を開く。iOS / Android 版（Web 版は pushTokens.ts）。
// 動くのは開発ビルド（と本番のビルド）の実機だけ。Expo Go・Web・シミュレータでは何もしない
// （判定は src/domain/push.ts の canRegisterPush。Expo Go は SDK 53 以降プッシュを扱えない）。
// 手順の中身は pushRegistration.ts（RN に依存しない。tests/push.test.mjs で検査する）。ここは実物を渡すだけ。
// 送る側は supabase/functions/notify（DB Webhook → Edge Function → Expo Push）。

import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

import type { Backend } from "./backend";
import {
  openLastResponse,
  openResponse,
  projectIdFrom,
  registerPushTokenWith,
} from "./pushRegistration";
import {
  canRegisterPush,
  type PushEnvironment,
  type PushRoute,
} from "../domain/push";
import { createOnce } from "../domain/once";
import type { Role } from "../domain/pairing";

function pushEnvironment(): PushEnvironment {
  return {
    os: Platform.OS,
    isDevice: Device.isDevice,
    // appOwnership は非推奨だが、Expo Go と開発ビルドを分けられるのはこれだけ
    // （executionEnvironment の storeClient はどちらでも同じ値）。
    appOwnership: Constants.appOwnership ?? null,
    executionEnvironment: Constants.executionEnvironment ?? null,
  };
}

const warnNoProjectId = createOnce();

// 許可を確かめ（未許可なら尋ね）、トークンを取って push_tokens に保存する。
export async function registerPushToken(
  backend: Backend,
  isCancelled?: () => boolean,
): Promise<void> {
  await registerPushTokenWith(
    {
      notifications: Notifications,
      env: pushEnvironment(),
      maxImportance: Notifications.AndroidImportance.MAX,
      projectId: projectIdFrom(
        Constants.expoConfig?.extra,
        Constants.easConfig?.projectId,
      ),
      warnNoProjectId: () =>
        warnNoProjectId.run(() =>
          console.warn(
            "EAS の projectId が無いので、通知のトークンを取りません（README の「プッシュ通知の準備」）。",
          ),
        ),
      isCancelled,
    },
    backend,
  );
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
    if (!backend || !pairId || !canRegisterPush(pushEnvironment())) return;
    // つなぎ直し（pairId が替わる・paired でなくなる）で取り消し、前の利用者で保存しない。
    let cancelled = false;
    registerPushToken(backend, () => cancelled).catch((e: unknown) =>
      console.warn("通知のトークンを保存できませんでした", e),
    );
    return () => {
      cancelled = true;
    };
  }, [backend, pairId]);

  useEffect(() => {
    if (!role || !canRegisterPush(pushEnvironment())) return;
    openLastResponse(Notifications, role, navigate);
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      openResponse(role, r, navigate),
    );
    return () => sub.remove();
  }, [role, navigate]);
}
