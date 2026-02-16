## 1. DataFetcher のキャッシュ無効化 API 追加

- [x] 1.1 `src/services/data-fetcher.js` に `invalidateIndexCache()` を追加し、index キャッシュのみを明示的に破棄できるようにする
- [x] 1.2 `fetchIndex()` / `fetchSession()` の戻り値互換性を維持することを確認し、既存ロジック（TTL、失敗時非キャッシュ、重複排除）を壊さないように調整する
- [x] 1.3 `tests/data/data-fetcher.test.js` に「明示的無効化後は TTL 内でも再取得する」テストを追加する

## 2. Admin と Dashboard の共有 fetcher 連携

- [x] 2.1 Admin と Dashboard が同一 `DataFetcher` インスタンスを参照する構成を導入する
- [x] 2.2 `src/pages/AdminPage.jsx` の CSV 一括保存成功時に `invalidateIndexCache()` を呼ぶ処理を追加する
- [x] 2.3 `src/pages/AdminPage.jsx` のグループ名保存成功時にも `invalidateIndexCache()` を呼び、再取得前にキャッシュを破棄する
- [x] 2.4 `src/pages/DashboardPage.jsx` で再表示時に最新 `index.json` を取得できることを確認する

## 3. テスト更新と回帰確認

- [x] 3.1 `tests/react/pages/AdminPage.test.jsx` に保存成功時のキャッシュ無効化呼び出しを検証するテストを追加する
- [x] 3.2 `tests/react/pages/DashboardPage.test.jsx` に管理画面保存後の再表示で最新データ取得を検証するテストを追加する
- [x] 3.3 `pnpm vitest run tests/data/data-fetcher.test.js tests/react/pages/AdminPage.test.jsx tests/react/pages/DashboardPage.test.jsx` を実行し、変更対象テストが通ることを確認する
