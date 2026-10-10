// アプリ内で共有するデータ型。設計ドキュメント docs/DESIGN.md のデータモデルに対応。

// 相談の種類
export type Category =
  | "money" // お金の話
  | "refund" // 還付金・税金
  | "construction" // 点検・工事・リフォーム
  | "impersonation" // 家族や役所を名乗る電話
  | "other"; // その他

// 子の判定（色分けに使う）
export type Verdict =
  | "danger" // 詐欺かも（赤）
  | "safe" // 大丈夫（緑）
  | "unsure"; // 確認中・注意（黄）

export interface Reply {
  verdict: Verdict;
  message: string;
  createdAt: number; // epoch ms
}

interface ConsultationBase {
  id: string;
  category: Category;
  photoUri?: string; // 任意で添付した写真（ローカルURI）。MVP後半で実装。
  createdAt: number; // epoch ms
  parentSeenAt?: number; // 親が答えの画面を開いた時刻 (epoch ms)。未読の答えを先に出すのに使う
}

// 返事待ち。reply は無い。
export interface WaitingConsultation extends ConsultationBase {
  status: "waiting";
}

// 子が答えた。reply が必ずある。
export interface AnsweredConsultation extends ConsultationBase {
  status: "answered";
  reply: Reply;
}

// status で reply の有無が決まる判別共用体。
// 「返事待ちなのに reply がある」「答え済みなのに reply が無い」を型の上で作れなくする。
export type Consultation = WaitingConsultation | AnsweredConsultation;
