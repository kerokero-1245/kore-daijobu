// 子の待ち画面で、親の端末で番号が入った（pairs が active になった）ことに気づくための読み直し。
// ペアの変化の購読・前面復帰・一定間隔の 3 つをまとめて始め、返す関数でまとめて止める
// （購読が確立する前の更新は届かないため、購読だけに頼らない）。
// React・React Native に依存しない（購読と前面復帰の口は呼び出し側が渡す。tests/wait-watch.test.mjs が読む）。

import { pollWhile } from "./poll";

export interface WaitWatchOptions {
  // ペアの変化を聞き始め、聞くのをやめる関数を返す。
  subscribe(onChange: () => void): () => void;
  // 前面に戻ったら呼ぶ口をつなぎ、外す関数を返す。
  onForeground(fn: () => void): () => void;
  // 読み直す（失敗しても画面に上げない形で）。
  check(): void;
  // 次の読み直しまでの間隔（回ごとに聞く）。
  delay(): number;
}

export function startWaitWatch(o: WaitWatchOptions): () => void {
  const stopSubscribe = o.subscribe(o.check);
  const stopForeground = o.onForeground(o.check);
  const stopPoll = pollWhile(o.check, o.delay);
  return () => {
    stopSubscribe();
    stopForeground();
    stopPoll();
  };
}
