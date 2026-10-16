// 相談のデータストア。画面はこの useStore だけを使う（StoreValue が画面との契約）。
// 中身はバックエンド（Supabase、開発中で設定が無ければ端末内の偽物。src/data/backendInstance.ts）と同期する:
//   - ペアが決まったら最近 50 件を取り、アプリが前面に戻るたびに取り直す
//   - 書き込みは先に手元を直してから送り、送れなければ手元を戻して syncError に理由を入れる
//   - ペアの変化（Realtime）を購読し、変わった 1 件を取り直す
// 同期の中身は consultationSync.ts（React に依存しない）にある。

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";

import { backend } from "./backendInstance";
import {
  createConsultationSync,
  type ConsultationSync,
  type SyncState,
} from "./consultationSync";
import { useSession } from "./session";
import type { Category, Consultation, Verdict } from "../types";

interface StoreValue {
  consultations: Consultation[];
  getConsultation: (id: string) => Consultation | undefined;
  createConsultation: (category: Category, photoUri?: string) => string; // 返り値: 作成したid
  replyToConsultation: (id: string, verdict: Verdict, message: string) => void;
  markAnswerSeen: (id: string) => void; // 親が答えを開いたことを記録する
  syncError?: string; // 送れなかったときの理由（一覧を取り直せたら消える）
}

const StoreContext = createContext<StoreValue | null>(null);

const EMPTY: SyncState = { consultations: [] };
const noSubscribe = () => () => {};
const emptyState = () => EMPTY;

function requireSync(sync: ConsultationSync | null): ConsultationSync {
  if (!sync)
    throw new Error("ペアリングが終わる前に相談を書き込もうとしました");
  return sync;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pairId = session.status === "paired" ? session.pairId : null;

  // ペアごとに同期の入れ物を 1 つ作る（作るだけで、通信は下の effect で始める）。
  const sync = useMemo(
    () =>
      pairId && backend
        ? createConsultationSync({
            backend,
            pairId,
            newId: randomUUID,
            onError: (e) => console.warn("同期に失敗しました", e),
          })
        : null,
    [pairId],
  );

  const { consultations, syncError } = useSyncExternalStore(
    sync ? sync.subscribe : noSubscribe,
    sync ? sync.getState : emptyState,
  );

  useEffect(() => {
    if (!sync) return;
    const stop = sync.start();
    // 前面に戻ったら取り直す（裏にいた間の変化は購読で届かないことがある）。
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void sync.refresh();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [sync]);

  const createConsultation = useCallback(
    (category: Category, photoUri?: string) =>
      requireSync(sync).create(category, photoUri),
    [sync],
  );

  const replyToConsultation = useCallback(
    (id: string, verdict: Verdict, message: string) =>
      requireSync(sync).reply(id, verdict, message),
    [sync],
  );

  const markAnswerSeen = useCallback(
    (id: string) => requireSync(sync).markSeen(id),
    [sync],
  );

  const getConsultation = useCallback(
    (id: string) => consultations.find((c) => c.id === id),
    [consultations],
  );

  const value = useMemo<StoreValue>(
    () => ({
      consultations,
      getConsultation,
      createConsultation,
      replyToConsultation,
      markAnswerSeen,
      ...(syncError === undefined ? {} : { syncError }),
    }),
    [
      consultations,
      getConsultation,
      createConsultation,
      replyToConsultation,
      markAnswerSeen,
      syncError,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore は StoreProvider の中で使ってください");
  return ctx;
}
