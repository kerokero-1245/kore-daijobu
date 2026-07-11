// 画面遷移の定義。各画面が受け取るパラメータの型。

export type RootStackParamList = {
  RoleSelect: undefined; // 開発用：親/子を切り替える入口
  // 親フロー
  ParentHome: undefined;
  CategorySelect: undefined;
  ParentStatus: { consultationId: string }; // 相談中→答え を表示
  // 子フロー
  ChildInbox: undefined;
  ConsultationDetail: { consultationId: string };
};