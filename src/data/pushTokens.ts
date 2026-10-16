// プッシュ通知のアプリ側。Web 版（iOS / Android 版は pushTokens.native.ts）。
// Web は expo-notifications の対応先に無く、読み込むだけでトークンの購読の警告が出るので、
// ここでは expo-notifications を読まずに何もしない（Web の即時の経路は Realtime だけ）。

import type { Backend } from "./backend";
import type { PushRoute } from "../domain/push";
import type { Role } from "../domain/pairing";

export async function registerPushToken(_backend: Backend): Promise<void> {}

export function usePushNotifications(
  _backend: Backend | null,
  _paired: { role: Role; pairId: string } | null,
  _navigate: (route: PushRoute) => void,
): void {}
