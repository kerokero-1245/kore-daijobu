// サインインとペアの状態を読む処理（session.tsx の中身）。React・React Native に依存しない（node --test で検査する）。
//   loading → choose_role（役割をまだ決めていない）
//           → child_unpaired（子。招待の番号を出して親を待つ）
//           → parent_unpaired（親。番号を入れる）
//           → paired（つながった。親はホーム、子は受信一覧）

import type { Backend, RedeemResult } from "./backend";
import { createLatest } from "./latest";
import {
  recheckAfterRedeem,
  sessionStatusOf,
  type PairInfo,
  type Role,
} from "../domain/pairing";

export type SessionState =
  // fatal: もう一度ためしても直らない（設定が無い）。起動画面に「もう一度」を出さない。
  | { status: "loading"; error?: string; fatal?: boolean }
  | { status: "choose_role" }
  | { status: "child_unpaired"; pairId: string }
  | { status: "parent_unpaired" }
  | { status: "paired"; role: Role; pairId: string };

export const LOAD_ERROR =
  "つながりませんでした。電波のよい所で、もう一度ためしてください。";

// 出す画面が変わらない読み直し（前面復帰・購読のつなぎ直し）では、前の状態をそのまま使う。
// 新しい状態を入れると、それを使う画面の effect が走り直す（子の番号が作り直される）。
export function sameState(a: SessionState, b: SessionState): boolean {
  if (a.status !== b.status) return false;
  if (a.status === "loading" && b.status === "loading")
    return a.error === b.error && a.fatal === b.fatal;
  if (a.status === "child_unpaired" && b.status === "child_unpaired")
    return a.pairId === b.pairId;
  if (a.status === "paired" && b.status === "paired")
    return a.pairId === b.pairId && a.role === b.role;
  return true;
}

// 役割とペアから状態を作る（子でペアがまだ無ければ作る）。
export async function readState(b: Backend): Promise<SessionState> {
  await b.signIn();
  const role = await b.getRole();
  let pair: PairInfo | null = await b.getPair();
  if (role === "child" && !pair) {
    await b.createPair();
    pair = await b.getPair();
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

// 読み込みは重なりうる（起動時・役割を選んだとき・番号を引き換えたとき・待つ間の読み直し）。
// 後から始めた読み込みの結果がもう入っていたら、先に始めた方の結果は捨てる（src/data/latest.ts）。
export interface SessionLoader {
  // 読んで画面の状態に入れる。失敗したら起動画面のエラー（loading + error）にする。
  load(): Promise<void>;
  // 待つ間の保険の読み直し。ペアだけを読み、つながっていたら全部を読み直して画面に入れる。
  // 失敗しても画面に上げない（電波が数秒切れただけで番号の画面を消さない）。
  refreshQuietly(): Promise<void>;
  // 親の端末で番号を引き換える。つながったら読み直して親のホームの状態にする。
  // 送れなかった・used・already_paired のあとも 1 回読み直す（前の送信が DB では済んでいたら、ホームへ進む）。
  redeem(code: string): Promise<RedeemResult>;
}

export interface SessionLoaderOptions {
  backend: () => Backend;
  apply: (next: SessionState) => void;
  warn?: (message: string, e?: unknown) => void;
}

export function createSessionLoader(
  options: SessionLoaderOptions,
): SessionLoader {
  const { apply } = options;
  const warn = options.warn ?? (() => {});
  const latest = createLatest();
  const loader: SessionLoader = {
    redeem: async (code) => {
      let result: RedeemResult;
      try {
        result = await options.backend().redeemInvite(code);
      } catch (e) {
        // 送れなかった。DB では引き換えが済み、応答だけが失われたこともあるので 1 回読み直す。
        void loader.refreshQuietly();
        throw e;
      }
      if (result.ok) await loader.load();
      else if (recheckAfterRedeem(result.reason)) void loader.refreshQuietly();
      return result;
    },
    load: () => {
      const seq = latest.begin();
      return readState(options.backend()).then(
        (next) => {
          if (latest.accept(seq, "result")) apply(next);
        },
        (e: unknown) => {
          warn("サインインに失敗しました", e);
          if (latest.accept(seq, "failure"))
            apply({ status: "loading", error: LOAD_ERROR });
        },
      );
    },
    refreshQuietly: async () => {
      // 数秒おきに走るので、まずペアだけを読む（サインインと役割は、つながったときだけ読み直す）。
      let pair: PairInfo | null;
      try {
        pair = await options.backend().getPair();
      } catch (e: unknown) {
        warn("読み直しに失敗しました（次の回で読み直します）", e);
        return;
      }
      if (pair?.status !== "active") return;
      const seq = latest.begin();
      return readState(options.backend()).then(
        (next) => {
          if (next.status === "loading") {
            warn("読み直しでペアを読めませんでした（次の回で読み直します）");
            return;
          }
          if (latest.accept(seq, "result")) apply(next);
        },
        (e: unknown) => {
          warn("読み直しに失敗しました（次の回で読み直します）", e);
        },
      );
    },
  };
  return loader;
}
