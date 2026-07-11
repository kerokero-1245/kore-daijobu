// MVP用の簡易データストア（メモリ内）。
// いまは Supabase の代わりに、アプリ内の state で親↔子のやり取りを再現する。
// 1台のスマホで「親モード」「子モード」を切り替えれば、一往復の流れをテストできる。
// 次の段階でこの中身を Supabase 呼び出しに差し替える（画面側は基本そのまま）。

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Category, Consultation, Verdict } from '../types';

interface StoreValue {
  consultations: Consultation[];
  getConsultation: (id: string) => Consultation | undefined;
  createConsultation: (category: Category, photoUri?: string) => string; // 返り値: 作成したid
  replyToConsultation: (id: string, verdict: Verdict, message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function newId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);

  const createConsultation = useCallback((category: Category, photoUri?: string) => {
    const id = newId();
    const item: Consultation = {
      id,
      category,
      photoUri,
      status: 'waiting',
      createdAt: Date.now(),
    };
    setConsultations((prev) => [item, ...prev]);
    return id;
  }, []);

  const replyToConsultation = useCallback(
    (id: string, verdict: Verdict, message: string) => {
      setConsultations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: 'answered', reply: { verdict, message, createdAt: Date.now() } }
            : c
        )
      );
    },
    []
  );

  const getConsultation = useCallback(
    (id: string) => consultations.find((c) => c.id === id),
    [consultations]
  );

  const value = useMemo<StoreValue>(
    () => ({ consultations, getConsultation, createConsultation, replyToConsultation }),
    [consultations, getConsultation, createConsultation, replyToConsultation]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore は StoreProvider の中で使ってください');
  return ctx;
}