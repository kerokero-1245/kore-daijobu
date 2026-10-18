// 一定の間隔で fn を呼び続け、止める関数を返す（React の effect の cleanup にそのまま渡せる）。
// 最初の呼び出しは間隔の後（始めた時点では呼ばない）。React・React Native に依存しない。
// 間隔は数か、回ごとに決める関数（呼ぶたびに次の間隔を聞く）で渡す。
export function pollWhile(
  fn: () => void,
  ms: number | (() => number),
): () => void {
  const delay = typeof ms === "number" ? () => ms : ms;
  let stopped = false;
  let id: ReturnType<typeof setTimeout>;
  const tick = () => {
    fn();
    if (!stopped) id = setTimeout(tick, delay());
  };
  id = setTimeout(tick, delay());
  return () => {
    stopped = true;
    clearTimeout(id);
  };
}
