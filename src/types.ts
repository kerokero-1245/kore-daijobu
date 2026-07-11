// アプリ内で共有するデータ型。設計ドキュメント docs/DESIGN.md のデータモデルに対応。

// 相談の種類
export type Category =
  | 'money' // お金の話
  | 'refund' // 還付金・税金
  | 'construction' // 点検・工事・リフォーム
  | 'impersonation' // 家族や役所を名乗る電話
  | 'other'; // その他

// 子の判定（色分けに使う）
export type Verdict =
  | 'danger' // 詐欺かも（赤）
  | 'safe' // 大丈夫（緑）
  | 'unsure'; // 確認中・注意（黄）

export interface Reply {
  verdict: Verdict;
  message: string;
  createdAt: number; // epoch ms
}

export type ConsultationStatus = 'waiting' | 'answered';

export interface Consultation {
  id: string;
  category: Category;
  photoUri?: string; // 任意で添付した写真（ローカルURI）。MVP後半で実装。
  status: ConsultationStatus;
  createdAt: number; // epoch ms
  reply?: Reply;
}