## 1. Vite プラグインの実装

- [x] 1.1 `vite.config.js` に `transformIndexHtml` フックを持つプラグイン関数を追加する。`VITE_APP_TITLE` 環境変数の値（未設定時は「Teams Board」）で `<title>` タグの内容を置換する
- [x] 1.2 `index.html` の `<title>` タグはデフォルト値を維持し、プラグインが `<title>` タグを正規表現で直接置換する方式に変更（Vite ビルトインの `%ENV%` 置換との競合を回避）

## 2. テスト

- [x] 2.1 `VITE_APP_TITLE` を設定してビルドし、`dist/index.html` の `<title>` タグにその値が埋め込まれていることを確認する
- [x] 2.2 `VITE_APP_TITLE` を未設定でビルドし、`dist/index.html` の `<title>` タグが「Teams Board」であることを確認する
- [x] 2.3 既存のユニットテスト（`pnpm test`）と lint（`pnpm run lint`）が通ることを確認する
