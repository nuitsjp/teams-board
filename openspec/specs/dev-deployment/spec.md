## ADDED Requirements

### Requirement: Development deployment uses shared application deployment workflow

開発デプロイ機能は、productionデプロイと同一のアプリデプロイ実体を共有し、環境値とトリガー条件のみを切り替えて実行されなければならない（SHALL）。CIワークフロー内に開発デプロイ処理を直接定義してはならない（SHALL NOT）。

#### Scenario: 開発/本番デプロイが共通実体で管理される

- **WHEN** アプリデプロイワークフロー定義を確認する
- **THEN** 開発デプロイと本番デプロイは同一ワークフロー実体内で管理され、環境値のみが分岐している

#### Scenario: CI定義に開発デプロイ処理が混在しない

- **WHEN** CIワークフロー定義を確認する
- **THEN** 開発デプロイ環境（dev）へのデプロイジョブは定義されていない

### Requirement: Development deployment reuses shared setup contract

開発デプロイでビルド前セットアップを行う場合、Node.js、pnpm、uvの準備はCIと同じ共通セットアップ契約を再利用しなければならない（SHALL）。

#### Scenario: 開発デプロイが共通セットアップを参照する

- **WHEN** 開発デプロイワークフロー内のビルド前処理を確認する
- **THEN** Node.js、pnpm、uvのセットアップは共通化された定義を利用している

#### Scenario: 共通セットアップ変更が開発デプロイにも反映される

- **WHEN** 共通セットアップ定義の更新を適用する
- **THEN** 開発デプロイのビルド前セットアップにも同じ更新が反映される

### Requirement: Development deployment requires successful CI

開発デプロイワークフローは、対象refに対する `ci-workflow`（lint/test/build）が成功している場合のみ実行しなければならない（SHALL）。CIが失敗または未実行の場合、デプロイ処理を開始してはならない（SHALL NOT）。

#### Scenario: CI成功時に開発デプロイが実行される

- **WHEN** mainブランチ向けPull Requestの対象コミットに対する `ci-workflow` が成功している
- **THEN** 開発デプロイワークフローはデプロイ処理を開始する

#### Scenario: CI未成功時に開発デプロイが中断される

- **WHEN** mainブランチ向けPull Requestの対象コミットに対する `ci-workflow` が失敗または未実行である
- **THEN** 開発デプロイワークフローはデプロイ処理を開始せず、失敗として終了する

## MODIFIED Requirements

### Requirement: Deployment triggers only on manual dispatch

開発デプロイワークフローは、mainブランチ向けPull Requestの作成・更新時に自動実行されなければならない（SHALL）。`workflow_dispatch` のみを前提とする運用にしてはならない（SHALL NOT）。

#### Scenario: PR作成・更新時に開発デプロイが発火する

- **WHEN** mainブランチ向けPull Requestが作成または更新される
- **THEN** 開発デプロイワークフローが自動的に開始される

#### Scenario: pushイベントのみでは開発デプロイが発火しない

- **WHEN** Pull Requestを伴わずにブランチへコミットがpushされる
- **THEN** 開発デプロイワークフローは発火しない

### Requirement: Supports deployment from any branch

開発デプロイワークフローは、mainブランチ向けPull Requestのソースとなる任意のブランチからデプロイ可能でなければならない（SHALL）。ソースブランチをmainのみに制限してはならない（SHALL NOT）。

#### Scenario: feature branchをソースにしたPRで開発デプロイできる

- **WHEN** feature branchからmainへのPull Requestが作成される
- **THEN** feature branchの内容が開発環境へデプロイされる

#### Scenario: release branchをソースにしたPRで開発デプロイできる

- **WHEN** release branchからmainへのPull Requestが作成される
- **THEN** release branchの内容が開発環境へデプロイされる
