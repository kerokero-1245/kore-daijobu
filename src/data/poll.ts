// 一定の間隔で fn を呼び続け、止める関数を返す（React の effect の cleanup にそのまま渡せる）。
// 最初の呼び出しは ms 後（始めた時点では呼ばない）。React・React Native に依存しない。
export function pollWhile(fn: () => void, ms: number): () => void {
  const id = setInterval(fn, ms);
  return () => clearInterval(id);
}
