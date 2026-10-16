// 画面遷移の定義。各画面が受け取るパラメータの型。

export type RootStackParamList = {
  RoleSelect: undefined; // 入口：このスマホを親・子のどちらで使うか選ぶ
  // ペアリング（6 桁の招待コード）
  ChildPairing: undefined; // 子：番号を出す
  ParentPairing: undefined; // 親：番号を入れる
  // 親フロー
  ParentHome: undefined;
  CategorySelect: undefined;
  ParentStatus: { consultationId: string }; // 相談中→答え を表示
  // 子フロー
  ChildInbox: undefined;
  ConsultationDetail: { consultationId: string };
};
