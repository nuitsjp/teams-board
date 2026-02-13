## Why

現行のGitHub Actions構成は、アプリ配信系とドキュメント配信系を含む複数ワークフローで重複処理や責務の曖昧さが残っており、変更時の影響範囲が広い。Issue #50で求められている統合・共通化・実行条件の見直しを、`deploy-site.yml` と `close-preview.yml` を含めて行い、運用負荷と実行コストを下げる必要がある。

## What Changes

- 現行ワークフローを棚卸しし、CI・開発デプロイ・本番デプロイ・補助ワークフローの責務境界を再定義する。
- 重複しているセットアップや実行手順を共通化し、不要なジョブ重複を削減する。
- イベントトリガー、パスフィルター、concurrency、依存関係の定義を見直し、不要実行を抑制する。
- PR向け検証フローとmain向けデプロイフローの実行条件を明確化し、運用上の予測可能性を高める。
- main向けPull Requestでは、`ci-workflow` 成功後に開発環境（dev）へのデプロイを実行し、テスト環境での検証経路を担保する。
- アプリ関連の開発環境/本番環境デプロイは、対象コミットの `ci-workflow`（lint/test/build）が成功している場合のみ実行可能とする。
- `dev-deployment` と `production-deployment` は、共通デプロイ処理を共有し、トリガー条件とGitHub Environmentの差分のみを持つ設計に統一する。
- ドキュメント配信ワークフロー（`deploy-site.yml`）とプレビュークローズ（`close-preview.yml`）の連携条件を最適化する。
- 文書更新時のtextlintは `docs-site-deployment` 内で配信前に実行し、個別ワークフローは廃止する。
- ドキュメント配信の手動実行は廃止し、トリガーはPull Requestとmain pushのみに限定する。

## Capabilities

### New Capabilities
- `docs-site-deployment`: ドキュメント配信ワークフローのトリガー、実行モード、共通化方針を最適化する。
- `preview-environment-cleanup`: PRクローズ時のプレビュー環境クローズ処理を安全かつ冪等に最適化する。

### Modified Capabilities
- `ci-workflow`: PR/mainに対する実行条件、ジョブ依存、並列実行、不要実行抑止の要件を最適化する。
- `dev-deployment`: 開発環境向けデプロイのトリガー条件と、CI成功ゲートを含む実行条件を最適化する。
- `production-deployment`: 本番環境向けデプロイの起動条件と、CI成功ゲートを含む実行条件を最適化する。

## Impact

- 主な影響範囲はGitHub Actions定義（`.github/workflows/*.yml`）と関連ドキュメント（運用手順、ワークフロー説明）である。
- とくに `deploy.yml`, `deploy-site.yml`, `close-preview.yml` の責務分離と共通化設計に影響する。
- Azure認証方式（OIDC）や既存のSecrets/Variables利用方針は維持し、機密情報管理方式の変更は行わない。
- CI/CD実行時間、ジョブ実行回数、失敗時の切り分け容易性に影響するため、変更後に実行結果を検証する。
