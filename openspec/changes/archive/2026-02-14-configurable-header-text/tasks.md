## 1. ヘッダーの説明文を環境変数化

- [x] 1.1 `App.jsx` のハードコードされた説明文を `import.meta.env.VITE_APP_DESCRIPTION` に置き換え、値が truthy な場合のみ `<span>` を条件付きレンダリングする
- [x] 1.2 `.env.example` に `VITE_APP_DESCRIPTION` をコメント付きで追加する

## 2. 既存環境ファイルの更新

- [x] 2.1 `.env.study-log` に `VITE_APP_DESCRIPTION=Teams レポート集計ダッシュボード` を追加する

## 3. テスト・検証

- [x] 3.1 `VITE_APP_DESCRIPTION` 設定時にヘッダーに説明文が表示されることを確認する
- [x] 3.2 `VITE_APP_DESCRIPTION` 未設定時に説明文の `<span>` が DOM に存在しないことを確認する
- [x] 3.3 既存のユニットテストが全件パスすることを確認する
- [x] 3.4 ビルドが成功することを確認する
