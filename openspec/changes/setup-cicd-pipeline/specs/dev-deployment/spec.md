## ADDED Requirements

### Requirement: Pull Request でトリガー
システムは Pull Request の作成・更新時に開発環境デプロイワークフローを自動的に実行しなければならない。

#### Scenario: Pull Request 作成
- **WHEN** 新しい Pull Request が作成される
- **THEN** 開発環境デプロイワークフローが自動的にトリガーされる

#### Scenario: Pull Request 更新
- **WHEN** 既存の Pull Request にコードが push される
- **THEN** 開発環境デプロイワークフローが再度トリガーされる

#### Scenario: main ブランチへの直接 push
- **WHEN** main ブランチに直接 push される
- **THEN** 開発環境デプロイワークフローはトリガーされない

### Requirement: CI ステップの成功確認
システムは Lint、テスト、ビルドがすべて成功した場合のみデプロイを実行しなければならない。

#### Scenario: CI ステップすべて成功
- **WHEN** Lint、テスト、ビルドがすべて成功する
- **THEN** 開発環境へのデプロイが実行される

#### Scenario: CI ステップのいずれかが失敗
- **WHEN** Lint、テスト、またはビルドのいずれかが失敗する
- **THEN** 開発環境へのデプロイは実行されない

### Requirement: OIDC 認証による Azure 接続
システムは OIDC 認証を使用して Azure に安全に接続しなければならない。

#### Scenario: OIDC 認証成功
- **WHEN** GitHub Actions から Azure への認証を行う
- **THEN** OIDC トークンを使用して認証が成功する

#### Scenario: OIDC 認証失敗
- **WHEN** OIDC 認証情報が不正または期限切れ
- **THEN** 認証が失敗し、デプロイが停止する

### Requirement: Azure Blob Storage へのデプロイ
システムはビルド成果物を開発環境の Azure Blob Storage にアップロードしなければならない。

#### Scenario: デプロイ成功
- **WHEN** ビルド成果物が dist ディレクトリに存在する
- **THEN** すべてのファイルが開発環境のストレージアカウントにアップロードされる

#### Scenario: デプロイ失敗
- **WHEN** ストレージアカウントへのアクセスに失敗する
- **THEN** デプロイが失敗し、エラーが報告される

### Requirement: デプロイ後の E2E テスト実行
システムは開発環境へのデプロイ完了後に E2E テストを自動的に実行しなければならない。

#### Scenario: デプロイ完了後の E2E テスト
- **WHEN** 開発環境へのデプロイが成功する
- **THEN** Playwright を使用した E2E テストが自動的に実行される

#### Scenario: E2E テスト成功
- **WHEN** すべての E2E テストが合格する
- **THEN** ワークフローが成功として完了する

#### Scenario: E2E テスト失敗
- **WHEN** 1 つ以上の E2E テストが失敗する
- **THEN** ワークフローが失敗として報告される

### Requirement: Playwright ブラウザのセットアップ
システムは E2E テスト実行前に Playwright ブラウザをセットアップしなければならない。

#### Scenario: ブラウザのインストール
- **WHEN** E2E テストを実行する前
- **THEN** Playwright ブラウザ（Chromium）がインストールされる

#### Scenario: ブラウザキャッシュの利用
- **WHEN** 以前に同じバージョンのブラウザをインストールしたことがある
- **THEN** キャッシュからブラウザを復元し、インストール時間を短縮する

### Requirement: E2E テストのリトライ機能
システムは一時的な失敗に対応するため、E2E テストのリトライ機能を提供しなければならない。

#### Scenario: 一時的なテスト失敗
- **WHEN** E2E テストが一時的なタイミング問題で失敗する
- **THEN** Playwright のリトライ機能により自動的に再試行される

#### Scenario: 継続的なテスト失敗
- **WHEN** E2E テストがリトライ後も失敗する
- **THEN** テストが失敗として報告される
