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

  const load = useCallback(
    (): Promise<void> =>
      readState().then(setState, (e: unknown) => {
        console.warn("サインインに失敗しました", e);
        setState({ status: "loading", error: LOAD_ERROR });
      }),
    [],
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

  const value = useMemo<SessionValue>(
    () => ({
      ...state,
      chooseRole,
      createInvite: () => backend.createInvite(),
      redeemInvite,
      restart,
      retry: () => {
        setState({ status: "loading" });
        void load();
      },
    }),
    [state, chooseRole, redeemInvite, restart, load],
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
