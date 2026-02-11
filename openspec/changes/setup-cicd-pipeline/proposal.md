## Why

現在、プロジェクトには CI/CD パイプラインが構築されておらず、テストやデプロイが手動で行われています。開発効率を向上させ、コード品質を維持し、人的ミスを削減するため、GitHub Actions を使用した自動化された CI/CD ワークフローが必要です。

## What Changes

- GitHub Actions ワークフローファイルを新規作成（`.github/workflows/deploy.yml`）
- 本番環境デプロイワークフロー（main ブランチへの push 時にトリガー）
  - 依存関係のインストール、Lint、単体テスト、ビルド、Azure Blob Storage へのデプロイ
- 開発環境デプロイワークフロー（Pull Request 作成・更新時にトリガー）
  - 依存関係のインストール、Lint、単体テスト、ビルド、Azure Blob Storage へのデプロイ、E2E テスト
- OIDC 認証を使用した Azure への安全な認証

## Capabilities

### New Capabilities

- `ci-workflow`: GitHub Actions を使った継続的インテグレーションワークフロー（Lint、単体テスト、ビルド）
- `production-deployment`: main ブランチへの push 時に本番環境（Azure Blob Storage）への自動デプロイ
- `dev-deployment`: Pull Request 作成・更新時に開発環境（Azure Blob Storage）への自動デプロイと E2E テスト実行

### Modified Capabilities

（なし）

## Impact

- **新規ファイル**: `.github/workflows/deploy.yml`
- **依存関係**: GitHub Actions、Azure Blob Storage、OIDC 認証設定が必要
- **開発フロー**: PR マージ時に自動的に本番環境にデプロイされるため、マージ前のレビューが重要
- **インフラ**: Azure 側で OIDC 用のアプリケーション登録と権限設定が必要
- **環境変数**: GitHub Secrets に Azure 認証情報（テナント ID、サブスクリプション ID、クライアント ID、ストレージアカウント名など）の設定が必要
