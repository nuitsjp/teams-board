## Why

DataFetcher はページ遷移のたびに `index.json` やセッション JSON を毎回ネットワーク取得しており、同一リソースへの不要なリクエストが発生している。インメモリキャッシュと同時リクエストの重複排除（inflight Promise 共有）を導入し、レスポンス速度とネットワーク効率を改善する。

## What Changes

- `index.json` に TTL ベースのインメモリキャッシュを追加（デフォルト 30 秒）
- セッション JSON（不変リソース）に永続インメモリキャッシュを追加
- 同一 URL への同時リクエストを 1 つの Promise に統合する重複排除メカニズムを追加
- `fetchIndex()` のキャッシュバスター（`?v=Date.now()`）を TTL 期間中はスキップするよう変更
- テストにキャッシュ・重複排除の検証ケースを追加

## Capabilities

### New Capabilities

- `data-fetcher-cache`: DataFetcher クラスにおけるインメモリキャッシュと重複排除の仕組み。TTL ベースキャッシュ（index.json）、永続キャッシュ（セッション JSON）、inflight Promise 共有による同時リクエスト統合を含む。

### Modified Capabilities

（既存スペックへの要件レベルの変更なし）

## Impact

- **対象コード**: `src/services/data-fetcher.js`、`tests/data/data-fetcher.test.js`
- **API**: DataFetcher の公開インターフェース（`fetchIndex()`, `fetchSession()`）は変更なし。戻り値の型も同一
- **依存関係**: 外部ライブラリの追加なし（カスタム実装）
- **副作用**: キャッシュにより、TTL 内は最新データが反映されない可能性がある（許容範囲）
