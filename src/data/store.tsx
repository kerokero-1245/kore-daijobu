// MVP用の簡易データストア（メモリ内）。
// いまは Supabase の代わりに、アプリ内の state で親↔子のやり取りを再現する。
// 1台のスマホで「親モード」「子モード」を切り替えれば、一往復の流れをテストできる。
// 次の段階でこの中身を Supabase 呼び出しに差し替える（画面側は基本そのまま）。

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  applyReply,
  newConsultation,
  recordAnswerSeen,
} from "../domain/consultation";
import type { Category, Consultation, Verdict } from "../types";

interface StoreValue {
  consultations: Consultation[];
  getConsultation: (id: string) => Consultation | undefined;
  createConsultation: (category: Category, photoUri?: string) => string; // 返り値: 作成したid
  replyToConsultation: (id: string, verdict: Verdict, message: string) => void;
  markAnswerSeen: (id: string) => void; // 親が答えを開いたことを記録する
}

const StoreContext = createContext<StoreValue | null>(null);

function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);

  const createConsultation = useCallback(
    (category: Category, photoUri?: string) => {
      const id = newId();
      const item = newConsultation(id, category, photoUri, Date.now());
      setConsultations((prev) => [item, ...prev]);
      return id;
    },
    [],
  );

  const replyToConsultation = useCallback(
    (id: string, verdict: Verdict, message: string) => {
      setConsultations((prev) =>
        applyReply(prev, id, verdict, message, Date.now()),
      );
    },
    [],
  );

  const markAnswerSeen = useCallback((id: string) => {
    setConsultations((prev) => recordAnswerSeen(prev, id, Date.now()));
  }, []);

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
    }),
    [
      consultations,
      getConsultation,
      createConsultation,
      replyToConsultation,
      markAnswerSeen,
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
