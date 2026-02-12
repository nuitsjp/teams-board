## ADDED Requirements

### Requirement: Deployment triggers only on push to main

本番デプロイワークフローは、mainブランチへのpush時のみ発火しなければならない（SHALL）。Pull Request時やfeature branchへのpush時には発火してはならない（SHALL NOT）。

#### Scenario: mainブランチへのpushでデプロイが発火する

- **WHEN** mainブランチにコミットがpushされる
- **THEN** 本番デプロイワークフローが自動的に開始される

#### Scenario: PRマージ時にデプロイが発火する

- **WHEN** Pull Requestがmainブランチにマージされる
- **THEN** 本番デプロイワークフローが自動的に開始される

#### Scenario: PR作成時にデプロイが発火しない

- **WHEN** mainブランチへのPull Requestが作成される
- **THEN** 本番デプロイワークフローは発火しない

#### Scenario: feature branchへのpushでデプロイが発火しない

- **WHEN** feature branchにコミットがpushされる
- **THEN** 本番デプロイワークフローは発火しない

### Requirement: Path filters prevent unnecessary deployments

本番デプロイワークフローは、コードや設定ファイルに変更があった場合のみ発火しなければならない（SHALL）。対象パスは `src/**`, `tests/**`, `e2e/**`, `package.json`, `pnpm-lock.yaml`, `vite.config.js`, `.github/workflows/deploy.yml` とする。

#### Scenario: コード変更時にデプロイが発火する

- **WHEN** `src/` ディレクトリ内のファイルが変更されてmainブランチにマージされる
- **THEN** 本番デプロイワークフローが発火する

#### Scenario: ドキュメントのみの変更時にデプロイが発火しない

- **WHEN** `README.md` のみが変更されてmainブランチにマージされる
- **THEN** 本番デプロイワークフローは発火しない

#### Scenario: ワークフロー定義変更時にデプロイが発火する

- **WHEN** `.github/workflows/deploy.yml` が変更されてmainブランチにマージされる
- **THEN** 本番デプロイワークフローが発火する

### Requirement: Deploys to production environment

本番デプロイワークフローは、ビルド成果物をAzure Blob Storageの本番環境（prod）にデプロイしなければならない（SHALL）。

#### Scenario: ビルド成果物が本番環境にデプロイされる

- **WHEN** 本番デプロイワークフローが実行される
- **THEN** Viteビルドで生成された `dist/` ディレクトリの内容がAzure Blob Storageのprod環境にアップロードされる

#### Scenario: 環境変数がprod用に設定される

- **WHEN** 本番デプロイワークフローが実行される
- **THEN** デプロイ先環境は `prod` として識別され、本番用の設定が適用される

### Requirement: Concurrency ensures deployment integrity

本番デプロイワークフローは、`deploy-prod` グループでconcurrency制御され、実行中のデプロイはキャンセルされてはならない（SHALL NOT）。

#### Scenario: 連続したpushでデプロイが順次実行される

- **WHEN** mainブランチに短時間で2つのコミットが連続してpushされる
- **THEN** 最初のデプロイが完了するまで2つ目のデプロイは待機し、両方のデプロイが順次完了する

#### Scenario: デプロイ実行中に新しいpushがあってもキャンセルされない

- **WHEN** 本番デプロイ実行中にmainブランチへ新しいコミットがpushされる
- **THEN** 実行中のデプロイは継続して完了し、新しいデプロイはその後に開始される

### Requirement: Uses OIDC authentication

本番デプロイワークフローは、Azure Blob Storageへの認証にOIDC（OpenID Connect）を使用しなければならない（SHALL）。SASトークンやアクセスキーを使用してはならない（SHALL NOT）。

#### Scenario: OIDCでAzure認証が成功する

- **WHEN** 本番デプロイワークフローが実行される
- **THEN** GitHub ActionsのOIDCプロバイダーを使用してAzureに認証し、デプロイが成功する

#### Scenario: SASトークンは使用されない

- **WHEN** 本番デプロイワークフローが実行される
- **THEN** デプロイプロセスでSASトークンやストレージアカウントキーは参照されない

### Requirement: No test or lint jobs in deployment workflow

本番デプロイワークフローは、test/lintジョブを含んではならない（SHALL NOT）。これらはCIワークフローの責務である。

#### Scenario: デプロイワークフローにtest/lintジョブが存在しない

- **WHEN** 本番デプロイワークフローの定義を確認する
- **THEN** test, lintジョブは定義されておらず、デプロイジョブのみが存在する

#### Scenario: CIの成功を待たずにデプロイが開始される

- **WHEN** mainブランチへのpushでCIと本番デプロイの両方が発火する
- **THEN** 本番デプロイワークフローはCIワークフローの完了を待たずに開始される（並列実行）
