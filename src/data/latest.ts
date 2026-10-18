// 重なって走る読み込み（取り直し）の結果を、始めた順で選ぶ入れ物。応答の着く順は始めた順と入れ替わりうる。
//   - 結果: 後から始めた読み込みの結果（成功か失敗）がもう入っていれば捨てる（古い中身で新しい中身を上書きしない）。
//   - 失敗: さらに、後から始めた読み込みがまだ走っていれば捨てる（新しい方の結果を待つ。失敗で画面を変えない）。
// 受け入れた結果は印になり、それより先に始めた読み込みの結果は以後すべて捨てる。
// React・React Native に依存しない（session の load と consultationSync の一覧の取り直しが使う）。

export interface Latest {
  // 読み込みを始めるときに呼び、番号を受け取る。
  begin(): number;
  // 番号 seq の結果を使ってよいか。true を返したら、その結果を使う前提で印を進める。
  accept(seq: number, outcome: "result" | "failure"): boolean;
}

export function createLatest(): Latest {
  let started = 0;
  let accepted = 0;
  return {
    begin: () => ++started,
    accept(seq, outcome) {
      if (seq <= accepted) return false;
      if (outcome === "failure" && seq !== started) return false;
      accepted = seq;
      return true;
    },
  };
}
