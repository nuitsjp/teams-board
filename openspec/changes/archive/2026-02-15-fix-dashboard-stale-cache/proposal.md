## Why

管理画面で CSV 保存直後にダッシュボードへ戻ると、`index.json` の TTL キャッシュが残っているため最新データが反映されない。手動リロードなしで更新結果を即時反映できない状態は、運用上の信頼性と操作体験を損なうため、早急な是正が必要である。

## What Changes

- 管理画面で保存処理が成功した時点で、`DataFetcher` の `index.json` キャッシュを明示的に無効化できる仕様を追加する。
- キャッシュ無効化後にダッシュボードが再取得した `index.json` を表示し、保存直後でも最新の集計結果を表示できるようにする。
- 既存の TTL キャッシュ方針と `fetchIndex()` / `fetchSession()` の戻り値互換性は維持する。
- 既存 spec `data-fetcher-cache` に、明示的無効化の要件とシナリオを追加する。

## Capabilities

### New Capabilities

- なし

### Modified Capabilities

- `data-fetcher-cache`: `index.json` キャッシュを明示的に無効化する要件を追加し、管理画面保存後の再表示で最新データを取得できることを定義する。

## Impact

- 影響コード: `src/services/data-fetcher.js`, `src/pages/AdminPage.jsx`, `src/pages/DashboardPage.jsx`
- 影響テスト: `tests/data/data-fetcher.test.js`, `tests/react/pages/AdminPage.test.jsx`, `tests/react/pages/DashboardPage.test.jsx`
- 公開インターフェース: `DataFetcher` にキャッシュ無効化用メソッドを追加（既存メソッドの互換性は維持）
- 外部依存やデータ形式の変更は想定しない
