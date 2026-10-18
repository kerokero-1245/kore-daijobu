// サインインとペアの状態。起動時に匿名でサインインし、役割とペアを読んで、出す画面を決める。
// 状態の一覧と読み込みの中身は sessionLoader.ts（React に依存しない）にある。
// 子は親の端末で番号が入るのを、ペアの変化の購読で待つ。

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { backend, requireBackend } from "./backendInstance";
import type { Invite, RedeemResult } from "./backend";
import {
  createSessionLoader,
  sameState,
  type SessionState,
} from "./sessionLoader";
import { startWaitWatch } from "./waitWatch";
import { waitPollDelay, type Role } from "../domain/pairing";

export type { SessionState } from "./sessionLoader";

type SessionValue = SessionState & {
  chooseRole: (role: Role) => Promise<void>;
  createInvite: () => Promise<Invite>;
  redeemInvite: (code: string) => Promise<RedeemResult>;
  // サインアウトして新しい匿名ユーザーで最初からやり直す
  // （「つなぎ直す」を押したとき）。
  restart: () => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const CONFIG_ERROR =
  "設定がありません。このアプリは、まだ使える状態になっていません。";

const INITIAL: SessionState = backend
  ? { status: "loading" }
  : { status: "loading", error: CONFIG_ERROR, fatal: true };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(INITIAL);

  const update = useCallback((next: SessionState) => {
    setState((prev) => (sameState(prev, next) ? prev : next));
  }, []);

  // 重なった読み込みは、後から始めた方の結果がもう入っていれば先の方を捨てる（sessionLoader.ts）。
  const loader = useMemo(
    () =>
      createSessionLoader({
        backend: requireBackend,
        apply: update,
        warn: (message, e) =>
          e === undefined ? console.warn(message) : console.warn(message, e),
      }),
    [update],
  );
  const { load, refreshQuietly } = loader;

  useEffect(() => {
    if (backend) void load();
  }, [load]);

  // 子が出している番号の期限（読み直しの間隔を決める。期限を過ぎたら間隔を延ばす）。
  const inviteExpiresAt = useRef<number | null>(null);

  // 子は、親の端末で番号が入って pairs が active になるのを待つ。ペアの変化の購読・前面復帰・
  // 数秒おきの読み直しをまとめて始め、待ち画面を離れたらまとめて止める（waitWatch.ts）。
  const waitingPairId = state.status === "child_unpaired" ? state.pairId : null;
  useEffect(() => {
    if (!waitingPairId) return;
    return startWaitWatch({
      subscribe: (onChange) =>
        requireBackend().subscribePair(waitingPairId, (e) => {
          if (e.kind !== "consultation") onChange();
        }),
      onForeground: (fn) => {
        const sub = AppState.addEventListener("change", (s) => {
          if (s === "active") fn();
        });
        return () => sub.remove();
      },
      check: () => void refreshQuietly(),
      delay: () => waitPollDelay(Date.now(), inviteExpiresAt.current),
    });
  }, [waitingPairId, refreshQuietly]);

  const chooseRole = useCallback(
    async (role: Role) => {
      try {
        await requireBackend().setRole(role);
        if (role === "child") await requireBackend().createPair();
      } catch (e) {
        console.warn("役割を保存できませんでした", e);
      }
      await load();
    },
    [load],
  );

  const redeemInvite = useCallback(
    async (code: string) => {
      const result = await requireBackend().redeemInvite(code);
      if (result.ok) await load();
      return result;
    },
    [load],
  );

  const restart = useCallback(async () => {
    setState({ status: "loading" });
    try {
      await requireBackend().signOut();
    } catch (e) {
      console.warn("サインアウトに失敗しました", e);
    }
    await load();
  }, [load]);

  // 画面の effect の依存に入るので、同じ関数を使い続ける（作り直すと子の番号が出し直しになる）。
  const createInvite = useCallback(
    () =>
      requireBackend()
        .createInvite()
        .then((invite) => {
          inviteExpiresAt.current = invite.expiresAt;
          return invite;
        }),
    [],
  );

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void load();
  }, [load]);

  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      chooseRole,
      createInvite,
      redeemInvite,
      restart,
      retry,
    }),
    [state, chooseRole, createInvite, redeemInvite, restart, retry],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession は SessionProvider の中で使ってください");
  return ctx;
}
