// 相談の一覧を手元に持ち、バックエンドと同期する（store.tsx の中身）。
// 書き込みは先に手元を直してから送り（楽観更新）、送れなければ手元を元に戻して syncError に理由を入れる。
// 手元の更新は既存の純関数（newConsultation・applyReply・recordAnswerSeen）を使う。
// 外から見ると「状態を持ち、変わったら知らせる」入れ物（React の useSyncExternalStore にそのまま渡せる）。
// React・React Native に依存しない（node --test で検査する）。

import type { Category, Consultation, Verdict } from "../types";
import { RECENT_LIMIT, type Backend } from "./backend";
import {
  applyReply,
  newConsultation,
  recordAnswerSeen,
} from "../domain/consultation";

export interface SyncState {
  consultations: Consultation[];
  syncError?: string;
}

// 送れなかったときに出す文言（親には文字入力を求めず、電話で確かめてもらう）。
export const SYNC_ERROR_MESSAGE = "つながっていません。電話で直接きいてね";

export interface ConsultationSync {
  getState(): SyncState;
  subscribe(listener: () => void): () => void;
  // 一覧を取り直し、購読を始める。返り値で購読をやめる。
  start(): () => void;
  refresh(): Promise<void>;
  create(category: Category, photoUri?: string): string;
  reply(id: string, verdict: Verdict, message: string): void;
  markSeen(id: string): void;
  // 書き込みが全部終わるまで待つ（テスト用）。
  idle(): Promise<void>;
}

export interface SyncOptions {
  backend: Backend;
  pairId: string;
  newId: () => string;
  now?: () => number;
  onError?: (e: unknown) => void;
}

function byNewest(a: Consultation, b: Consultation): number {
  return b.createdAt - a.createdAt;
}

export function createConsultationSync(options: SyncOptions): ConsultationSync {
  const { backend, pairId, newId } = options;
  const now = options.now ?? Date.now;
  let state: SyncState = { consultations: [] };
  const listeners = new Set<() => void>();
  // 送信中の相談（id → 手元の版）。取り直しで届いた古い行に上書きされないよう、送り終わるまで手元を優先する。
  const pending = new Map<string, Consultation>();
  const inflight = new Set<Promise<void>>();

  const set = (next: SyncState) => {
    state = next;
    listeners.forEach((l) => l());
  };
  // error: 文字列なら入れる・"clear" なら消す（同期できた）・"keep" ならそのまま。
  const setList = (
    consultations: Consultation[],
    error: string | "clear" | "keep" = "keep",
  ) => {
    const syncError =
      error === "keep"
        ? state.syncError
        : error === "clear"
          ? undefined
          : error;
    set(
      syncError === undefined
        ? { consultations }
        : { consultations, syncError },
    );
  };

  const track = (p: Promise<void>) => {
    inflight.add(p);
    void p.finally(() => inflight.delete(p));
  };

  // 1 件を手元の一覧に入れる（無ければ足す・あれば置き換える）。
  const upsert = (list: Consultation[], c: Consultation) =>
    list.some((x) => x.id === c.id)
      ? list.map((x) => (x.id === c.id ? c : x))
      : [c, ...list].sort(byNewest);

  // 取り直せなかったら、手元の一覧はそのままで syncError を入れる（取り直せたら "clear" で消す）。
  const refresh = async () => {
    let remote: Consultation[];
    try {
      remote = await backend.listConsultations(pairId, RECENT_LIMIT);
    } catch (e) {
      setList(state.consultations, SYNC_ERROR_MESSAGE);
      throw e;
    }
    let list = remote;
    for (const local of pending.values()) list = upsert(list, local);
    setList(list.sort(byNewest), "clear");
  };

  const refreshOne = async (id: string) => {
    if (pending.has(id)) return;
    const c = await backend.getConsultation(id);
    if (!c || pending.has(id)) return;
    setList(upsert(state.consultations, c));
  };

  const report = (e: unknown) => {
    options.onError?.(e);
  };

  // 楽観更新を送る。失敗したら undo で手元を戻し、syncError を入れる。
  const send = (
    id: string,
    local: Consultation,
    write: () => Promise<void>,
    undo: (list: Consultation[]) => Consultation[],
  ) => {
    pending.set(id, local);
    track(
      write().then(
        async () => {
          pending.delete(id);
          await refreshOne(id).catch(report);
        },
        (e: unknown) => {
          pending.delete(id);
          report(e);
          setList(undo(state.consultations), SYNC_ERROR_MESSAGE);
        },
      ),
    );
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      track(refresh().catch(report));
      return backend.subscribePair(pairId, (e) => {
        if (e.kind === "consultation") track(refreshOne(e.id).catch(report));
        else track(refresh().catch(report));
      });
    },
    refresh: () => refresh().catch(report),
    create(category, photoUri) {
      const id = newId();
      const item = newConsultation(id, category, photoUri, now());
      setList([item, ...state.consultations]);
      send(
        id,
        item,
        () => backend.insertConsultation({ id, pairId, category }),
        (list) => list.filter((c) => c.id !== id),
      );
      return id;
    },
    reply(id, verdict, message) {
      const before = state.consultations.find((c) => c.id === id);
      const next = applyReply(state.consultations, id, verdict, message, now());
      if (!before || next === state.consultations) return;
      setList(next);
      const local = next.find((c) => c.id === id);
      if (!local) return;
      send(
        id,
        local,
        () => backend.insertReply(id, verdict, message),
        (list) => list.map((c) => (c.id === id ? before : c)),
      );
    },
    markSeen(id) {
      const next = recordAnswerSeen(state.consultations, id, now());
      if (next === state.consultations) return;
      setList(next);
      // 開いた印は並び順の補助なので、送れなくても手元は戻さない
      // （戻すと答えの画面が「まだ開いていない」と見て送り直し続けるため）。
      track(
        backend.markSeen(id).catch((e: unknown) => {
          report(e);
          setList(state.consultations, SYNC_ERROR_MESSAGE);
        }),
      );
    },
    async idle() {
      while (inflight.size > 0) await Promise.all([...inflight]);
    },
  };
}
