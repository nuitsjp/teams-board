## ADDED Requirements

### Requirement: main ブランチへの push でトリガー
システムは main ブランチへの push 時に本番環境デプロイワークフローを自動的に実行しなければならない。

#### Scenario: main ブランチへの push
- **WHEN** main ブランチにコードが push される
- **THEN** 本番環境デプロイワークフローが自動的にトリガーされる

#### Scenario: 他のブランチへの push
- **WHEN** main 以外のブランチにコードが push される
- **THEN** 本番環境デプロイワークフローはトリガーされない

### Requirement: CI ステップの成功確認
システムは Lint、テスト、ビルドが全て成功した場合のみデプロイを実行しなければならない。

#### Scenario: CI ステップ全て成功
- **WHEN** Lint、テスト、ビルドが全て成功する
- **THEN** 本番環境へのデプロイが実行される

#### Scenario: CI ステップのいずれかが失敗
- **WHEN** Lint、テスト、またはビルドのいずれかが失敗する
- **THEN** 本番環境へのデプロイは実行されない

### Requirement: OIDC 認証による Azure 接続
システムは OIDC 認証を使用して Azure に安全に接続しなければならない。

#### Scenario: OIDC 認証成功
- **WHEN** GitHub Actions から Azure への認証を行う
- **THEN** OIDC トークンを使用して認証が成功する

#### Scenario: OIDC 認証失敗
- **WHEN** OIDC 認証情報が不正または期限切れ
- **THEN** 認証が失敗し、デプロイが停止する

### Requirement: Azure Blob Storage へのデプロイ
システムはビルド成果物を本番環境の Azure Blob Storage にアップロードしなければならない。

#### Scenario: デプロイ成功
- **WHEN** ビルド成果物が dist ディレクトリに存在する
- **THEN** 全てのファイルが本番環境のストレージアカウントにアップロードされる

#### Scenario: デプロイ失敗
- **WHEN** ストレージアカウントへのアクセスに失敗する
- **THEN** デプロイが失敗し、エラーが報告される

### Requirement: 本番環境での E2E テスト除外
システムは本番環境デプロイ後に E2E テストを実行してはならない。

#### Scenario: 本番環境デプロイ後
- **WHEN** 本番環境へのデプロイが完了する
- **THEN** E2E テストは実行されない

#### Scenario: 本番環境へのテストトラフィック回避
- **WHEN** デプロイワークフローが実行される
- **THEN** 本番環境に対するテストトラフィックが発生しない
