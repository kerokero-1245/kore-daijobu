// 続けて呼ばれても最初の 1 回だけ実行する入れ物（二重押しの抑止）。
// 純関数だけで書き、React・画面に依存しない（フックは src/hooks/useOnce.ts）。

export interface Once {
  // まだ実行していなければ fn を実行する。実行済みなら何もしない。
  run(fn: () => void): void;
  // 実行済みの印を消して、もう一度 run できるようにする。
  reset(): void;
}

export function createOnce(): Once {
  let done = false;
  return {
    run(fn) {
      if (done) return;
      done = true;
      fn();
    },
    reset() {
      done = false;
    },
  };
}
