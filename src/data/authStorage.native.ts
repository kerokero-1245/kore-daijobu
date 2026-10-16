// supabase-js のセッション（ログイン状態）の置き場所。iOS / Android 版（Web 版は authStorage.ts）。
// セッションは相談を読める鍵なので平文で置かない。SecureStore は 2048 バイトを超える値を置けないため、
// 本体は AES-256（CTR）で暗号化して AsyncStorage に、鍵だけを SecureStore に置く
// （Supabase の Expo 向けチュートリアルの LargeSecureStore と同じ形）。

import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as aesjs from "aes-js";

import type { AuthStorage } from "./authStorage";

async function encrypt(key: string, value: string): Promise<string> {
  const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
  const cipher = new aesjs.ModeOfOperation.ctr(
    encryptionKey,
    new aesjs.Counter(1),
  );
  const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
  await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(key: string, value: string): Promise<string | null> {
  const encryptionKeyHex = await SecureStore.getItemAsync(key);
  if (!encryptionKeyHex) return null;
  const cipher = new aesjs.ModeOfOperation.ctr(
    aesjs.utils.hex.toBytes(encryptionKeyHex),
    new aesjs.Counter(1),
  );
  const decrypted = cipher.decrypt(aesjs.utils.hex.toBytes(value));
  return aesjs.utils.utf8.fromBytes(decrypted);
}

export const authStorage: AuthStorage = {
  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return encrypted;
    return decrypt(key, encrypted);
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
  async setItem(key, value) {
    const encrypted = await encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  },
};
