## ADDED Requirements

### Requirement: Production deployment uses shared application deployment workflow

本番デプロイ機能は、devデプロイと同一のアプリデプロイ実体を共有し、環境値とトリガー条件のみを切り替えて実行されなければならない（SHALL）。CIワークフロー内に本番デプロイ処理を直接定義してはならない（SHALL NOT）。

#### Scenario: 開発/本番デプロイが共通実体で管理される

- **WHEN** アプリデプロイワークフロー定義を確認する
- **THEN** 本番デプロイと開発デプロイは同一ワークフロー実体内で管理され、環境値のみが分岐している

#### Scenario: CI定義に本番デプロイ処理が混在しない

- **WHEN** CIワークフロー定義を確認する
- **THEN** 本番環境（prod）へのデプロイジョブは定義されていない

### Requirement: Production deployment reuses shared setup contract

本番デプロイでビルドまたは成果物検証を行う場合、Node.js、pnpm、uvの準備はCIと同じ共通セットアップ契約を再利用しなければならない（SHALL）。

#### Scenario: 本番デプロイが共通セットアップを参照する

- **WHEN** 本番デプロイワークフロー内でビルド関連ステップを確認する
- **THEN** Node.js、pnpm、uvのセットアップは共通化された定義を利用している

#### Scenario: 共通セットアップ更新が本番デプロイにも反映される

- **WHEN** 共通セットアップ定義の更新を適用する
- **THEN** 本番デプロイのビルド関連ステップにも同じ更新が反映される

### Requirement: Production deployment requires successful CI

本番デプロイワークフローは、同一コミットに対する `ci-workflow`（lint/test/build）が成功している場合のみデプロイ処理を開始しなければならない（SHALL）。CIが失敗または未完了の場合、デプロイ処理を開始してはならない（SHALL NOT）。

#### Scenario: CI成功後に本番デプロイが開始される

- **WHEN** mainブランチ上の対象コミットに対する `ci-workflow` が成功している
- **THEN** 本番デプロイワークフローはデプロイ処理を開始する

#### Scenario: CI未成功時に本番デプロイが中断される

- **WHEN** mainブランチ上の対象コミットに対する `ci-workflow` が失敗または未完了である
- **THEN** 本番デプロイワークフローはデプロイ処理を開始せず、失敗として終了する

## MODIFIED Requirements

### Requirement: No test or lint jobs in deployment workflow

本番デプロイワークフローは、test/lintジョブを含んではならない（SHALL NOT）。これらはCIワークフローの責務であり、デプロイ前提としてCI成功を参照しなければならない（SHALL）。

#### Scenario: デプロイワークフローにtest/lintジョブが存在しない

- **WHEN** 本番デプロイワークフローの定義を確認する
- **THEN** test, lintジョブは定義されておらず、デプロイジョブのみが存在する

#### Scenario: CI成功後にデプロイが開始される

- **WHEN** mainブランチへのpushでCIと本番デプロイの両方が発火する
- **THEN** 本番デプロイワークフローは対象コミットのCI成功を確認した後に開始される
