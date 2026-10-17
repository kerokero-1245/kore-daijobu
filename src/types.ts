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

// 自作の絵（src/components/icons/Icon.tsx）の名前。絵文字の代わりに、表や画面はこの名前で絵を指す。
export type IconName =
  | "parent" // 親（年配の人）
  | "child" // 子（大人）
  | "shield" // 盾（親ホームの大ボタン）
  | "cat-money" // 種類: お金の話
  | "cat-refund" // 種類: 還付金・税金
  | "cat-construction" // 種類: 点検・工事・リフォーム
  | "cat-impersonation" // 種類: 家族や役所を名乗る電話
  | "cat-other" // 種類: その他
  | "erase" // 消す
  | "status-answered" // 返信済み
  | "status-waiting" // 未対応
  | "verdict-danger" // 判定: 詐欺かも
  | "verdict-safe" // 判定: 大丈夫そう
  | "verdict-unsure" // 判定: まだ分からない
  | "entry-unseen" // 入口: 答えが届きました
  | "entry-waiting" // 入口: 返事を待っています
  | "entry-seen" // 入口: 確認ずみの答え
  | "arrow-back" // もどる
  | "connect" // つなぐ
  | "timer"; // のこり時間
