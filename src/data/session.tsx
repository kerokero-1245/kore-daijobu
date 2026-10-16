// サインインとペアの状態。起動時に匿名でサインインし、役割とペアを読んで、出す画面を決める。
//   loading → choose_role（役割をまだ決めていない）
//           → child_unpaired（子。招待の番号を出して親を待つ）
//           → parent_unpaired（親。番号を入れる）
//           → paired（つながった。親はホーム、子は受信一覧）
// 子は親の端末で番号が入るのを、ペアの変化の購読で待つ。

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

import { backend } from "./backendInstance";
import type { Invite, RedeemResult } from "./backend";
import { sessionStatusOf, type PairInfo, type Role } from "../domain/pairing";

export type SessionState =
  | { status: "loading"; error?: string }
  | { status: "choose_role" }
  | { status: "child_unpaired"; pairId: string }
  | { status: "parent_unpaired" }
  | { status: "paired"; role: Role; pairId: string };

type SessionValue = SessionState & {
  chooseRole: (role: Role) => Promise<void>;
  createInvite: () => Promise<Invite>;
  redeemInvite: (code: string) => Promise<RedeemResult>;
  // 開発用: サインアウトして新しい匿名ユーザーで最初からやり直す。
  restart: () => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const LOAD_ERROR =
  "つながりませんでした。電波のよい所で、もう一度ためしてください。";

// 出す画面が変わらない読み直し（前面復帰・購読のつなぎ直し）では、前の状態をそのまま使う。
// 新しい状態を入れると、それを使う画面の effect が走り直す（子の番号が作り直される）。
function sameState(a: SessionState, b: SessionState): boolean {
  if (a.status !== b.status) return false;
  if (a.status === "loading" && b.status === "loading")
    return a.error === b.error;
  if (a.status === "child_unpaired" && b.status === "child_unpaired")
    return a.pairId === b.pairId;
  if (a.status === "paired" && b.status === "paired")
    return a.pairId === b.pairId && a.role === b.role;
  return true;
}

// 役割とペアから状態を作る（子でペアがまだ無ければ作る）。
async function readState(): Promise<SessionState> {
  await backend.signIn();
  const role = await backend.getRole();
  let pair: PairInfo | null = await backend.getPair();
  if (role === "child" && !pair) {
    await backend.createPair();
    pair = await backend.getPair();
  }
  const status = sessionStatusOf(role, pair);
  switch (status) {
    case "paired":
      return pair
        ? { status, role: pair.role, pairId: pair.pairId }
        : { status: "choose_role" };
    case "child_unpaired":
      return pair
        ? { status, pairId: pair.pairId }
        : { status: "loading", error: LOAD_ERROR };
    default:
      return { status };
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const update = useCallback((next: SessionState) => {
    setState((prev) => (sameState(prev, next) ? prev : next));
  }, []);

  const load = useCallback(
    (): Promise<void> =>
      readState().then(update, (e: unknown) => {
        console.warn("サインインに失敗しました", e);
        update({ status: "loading", error: LOAD_ERROR });
      }),
    [update],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // 子は、親の端末で番号が入って pairs が active になるのを待つ。前面に戻ったときも読み直す。
  const waitingPairId = state.status === "child_unpaired" ? state.pairId : null;
  useEffect(() => {
    if (!waitingPairId) return;
    const stop = backend.subscribePair(waitingPairId, (e) => {
      if (e.kind !== "consultation") void load();
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void load();
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [waitingPairId, load]);

  const chooseRole = useCallback(
    async (role: Role) => {
      try {
        await backend.setRole(role);
        if (role === "child") await backend.createPair();
      } catch (e) {
        console.warn("役割を保存できませんでした", e);
      }
      await load();
    },
    [load],
  );

  const redeemInvite = useCallback(
    async (code: string) => {
      const result = await backend.redeemInvite(code);
      if (result.ok) await load();
      return result;
    },
    [load],
  );

  const restart = useCallback(async () => {
    setState({ status: "loading" });
    try {
      await backend.signOut();
    } catch (e) {
      console.warn("サインアウトに失敗しました", e);
    }
    await load();
  }, [load]);

  // 画面の effect の依存に入るので、同じ関数を使い続ける（作り直すと子の番号が出し直しになる）。
  const createInvite = useCallback(() => backend.createInvite(), []);

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
