// 時刻の表示。画面と読み上げで同じ書き方にそろえる。
// 純関数だけを置く（React・React Native に依存しない）。

// 端末のタイムゾーンで「10月11日 09:30」の形にする（月・日はゼロ埋めなし、時・分はゼロ埋め）。
export function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`;
}
