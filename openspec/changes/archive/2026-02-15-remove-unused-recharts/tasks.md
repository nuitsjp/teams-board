## 1. 依存削除

- [x] 1.1 `pnpm remove recharts` を実行して `package.json` と `pnpm-lock.yaml` から recharts を削除する
- [x] 1.2 `.vscode/settings.json` のスペルチェック辞書から `recharts` を削除する

## 2. 検証

- [x] 2.1 `pnpm run build` を実行してビルドが成功することを確認する
- [x] 2.2 `pnpm test` を実行してすべてのユニットテストがパスすることを確認する
- [x] 2.3 `pnpm run lint` を実行して ESLint エラーがないことを確認する
- [x] 2.4 ビルド前後のバンドルサイズを比較して削減を確認する
