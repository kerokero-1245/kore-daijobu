// supabase-js のセッション（ログイン状態）の置き場所。Web 版（.native.ts が iOS / Android 版）。
// Web には expo-secure-store が無いので、AsyncStorage（中身は localStorage）に平文で置く。
// ブラウザの保存域は同じオリジンのページからしか読めず、暗号化しても鍵を同じ場所に置くことになるため。

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const authStorage: AuthStorage = AsyncStorage;
