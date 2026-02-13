## Why

現在のGitHub Actionsワークフロー構成には重複実行（PRとpushで同じテストが二重に実行）、全ブランチでの無差別発火、パスフィルターの欠如、存在しないファイル参照などの問題があり、CI効率が低下している。3ファイル構成（CI + Deploy + Dev Deploy）に再構築することで、これらの問題を解消し、適切な実行制御とリソース最適化を実現する。

## What Changes

- `test.yml` を `ci.yml` にリネーム・再構築し、test/lint/buildを並列実行するCIパイプラインに統合
- `deploy.yml` を本番デプロイ専用に改修（mainブランチpush時のみ、test/lintジョブ削除、パスフィルター追加）
- `deploy-dev.yml` を新規作成（workflow_dispatch手動トリガー、将来のE2Eテスト統合に備える）
- すべてのワークフローにパスフィルターを追加（`src/**`, `tests/**`, `e2e/**`, 設定ファイル等）
- concurrency設定を追加（PR単位でのキャンセル、デプロイのグループ化）
- deploy.ymlの初期データ配置ステップを削除（`scripts/seed/index.json`が存在しないため）

## Capabilities

### New Capabilities

- `ci-workflow`: 統合されたCIパイプライン。PR to mainとpush to mainで発火し、test/lint/buildを並列実行。パスフィルターによる最適化とconcurrency制御により重複を排除
- `production-deployment`: 本番環境へのデプロイワークフロー。mainブランチへのpush時のみ発火し、ビルド成果物をAzure Blob Storageの本番環境にデプロイ
- `dev-deployment`: 開発環境への手動デプロイワークフロー。workflow_dispatchで手動実行し、任意のブランチから開発環境へデプロイ可能。将来のE2Eテスト統合の拡張ポイントを含む

### Modified Capabilities

なし

## Impact

- `.github/workflows/test.yml` → `.github/workflows/ci.yml`（リネーム＋全面改修）
- `.github/workflows/deploy.yml`（トリガー、ジョブ構成、環境設定の大幅改修）
- `.github/workflows/deploy-dev.yml`（新規作成）
- GitHub Actionsの実行回数とコスト削減（PR to main: 4ジョブ→3ジョブ、push to main: 4ジョブのまま重複なし）
- feature branchのpush時のムダな実行を完全に排除（PRがない限り発火しない）
