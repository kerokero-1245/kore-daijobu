// 動的設定（Expo SDK 57）。静的な app.json を土台として読み込み、
// GitHub Pages のサブパス配信のためのベースパスだけを「ビルド時のみ」上書きする。
//
// - ローカル開発（npm start / expo start）では EXPO_BASE_URL 未設定 → baseUrl なし（ルート配信のまま）。
// - CI の Web 書き出し時に EXPO_BASE_URL=/kore-daijobu を渡す → dist の全アセットが /kore-daijobu/ 前提になる。
//
// experiments.baseUrl の仕様は Expo SDK 57 公式ドキュメント（config/app, guides/publishing-websites）に準拠。
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (baseUrl) {
    config.experiments = { ...(config.experiments ?? {}), baseUrl };
  }
  return config;
};
