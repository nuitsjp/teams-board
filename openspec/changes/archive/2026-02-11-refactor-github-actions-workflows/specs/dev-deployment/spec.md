## ADDED Requirements

### Requirement: Deployment triggers only on manual dispatch

開発デプロイワークフローは、workflow_dispatchによる手動実行時のみ発火しなければならない（SHALL）。自動トリガー（push, pull_request等）を持ってはならない（SHALL NOT）。

#### Scenario: 手動実行でデプロイが開始される

- **WHEN** GitHub Actions UIから開発デプロイワークフローを手動実行する
- **THEN** 開発デプロイワークフローが開始され、指定されたブランチからビルドとデプロイが実行される

#### Scenario: pushイベントでデプロイが発火しない

- **WHEN** 任意のブランチにコミットがpushされる
- **THEN** 開発デプロイワークフローは発火しない

#### Scenario: PR作成時にデプロイが発火しない

- **WHEN** Pull Requestが作成される
- **THEN** 開発デプロイワークフローは発火しない

### Requirement: Supports deployment from any branch

開発デプロイワークフローは、任意のブランチからデプロイ可能でなければならない（SHALL）。mainブランチに限定してはならない（SHALL NOT）。

#### Scenario: feature branchから開発環境にデプロイできる

- **WHEN** feature branchを指定して開発デプロイワークフローを手動実行する
- **THEN** 指定されたfeature branchのコードがビルドされ、開発環境にデプロイされる

#### Scenario: mainブランチから開発環境にデプロイできる

- **WHEN** mainブランチを指定して開発デプロイワークフローを手動実行する
- **THEN** mainブランチのコードがビルドされ、開発環境にデプロイされる

### Requirement: Deploys to development environment

開発デプロイワークフローは、ビルド成果物をAzure Blob Storageの開発環境（dev）にデプロイしなければならない（SHALL）。本番環境にデプロイしてはならない（SHALL NOT）。

#### Scenario: ビルド成果物が開発環境にデプロイされる

- **WHEN** 開発デプロイワークフローが実行される
- **THEN** Viteビルドで生成された `dist/` ディレクトリの内容がAzure Blob Storageのdev環境にアップロードされる

#### Scenario: 環境変数がdev用に設定される

- **WHEN** 開発デプロイワークフローが実行される
- **THEN** デプロイ先環境は `dev` として識別され、開発用の設定が適用される

#### Scenario: 本番環境には影響しない

- **WHEN** 開発デプロイワークフローが実行される
- **THEN** 本番環境（prod）のデータやファイルは一切変更されない

### Requirement: Concurrency allows cancellation

開発デプロイワークフローは、`deploy-dev` グループでconcurrency制御され、新しい実行時に古い実行をキャンセル可能でなければならない（SHALL）。

#### Scenario: 新しい手動実行で古い実行がキャンセルされる

- **WHEN** 開発デプロイが実行中に新しい手動実行が開始される
- **THEN** 実行中の古いデプロイは自動的にキャンセルされ、新しいデプロイが開始される

#### Scenario: 本番デプロイと干渉しない

- **WHEN** 開発デプロイと本番デプロイが同時に実行される
- **THEN** 両方のデプロイは互いに干渉せず、それぞれ独立して完了する

### Requirement: Uses OIDC authentication

開発デプロイワークフローは、Azure Blob Storageへの認証にOIDC（OpenID Connect）を使用しなければならない（SHALL）。SASトークンやアクセスキーを使用してはならない（SHALL NOT）。

#### Scenario: OIDCでAzure認証が成功する

- **WHEN** 開発デプロイワークフローが実行される
- **THEN** GitHub ActionsのOIDCプロバイダーを使用してAzureに認証し、デプロイが成功する

### Requirement: Provides extension point for E2E tests

開発デプロイワークフローは、将来のE2Eテスト統合のための拡張ポイントをコメントで明示しなければならない（SHALL）。

#### Scenario: E2Eテスト統合のコメントが存在する

- **WHEN** 開発デプロイワークフローの定義を確認する
- **THEN** E2Eテスト統合の拡張ポイントを示すコメントが含まれている

#### Scenario: 拡張ポイントはデプロイ後に配置される

- **WHEN** 開発デプロイワークフローの定義を確認する
- **THEN** E2Eテスト拡張ポイントのコメントは、デプロイステップの後に配置されている
