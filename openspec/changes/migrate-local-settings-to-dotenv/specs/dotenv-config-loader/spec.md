## ADDED Requirements

### Requirement: .envファイルからの環境変数読み込み

`Load-EnvSettings` 関数は、プロジェクトルートの `.env` ファイルを読み込み、キーと値のペアをハッシュテーブルとして返す機能を提供しなければならない（SHALL）。

#### Scenario: .envファイルが存在する場合の正常読み込み

- **WHEN** プロジェクトルートに `.env` ファイルが存在する
- **THEN** ファイル内の `KEY=VALUE` 形式の各行がパースされ、キーと値のハッシュテーブルが返される

#### Scenario: .envファイルが存在しない場合

- **WHEN** プロジェクトルートに `.env` ファイルが存在しない
- **THEN** `$null` が返される

#### Scenario: コメント行と空行のスキップ

- **WHEN** `.env` ファイルに `#` で始まる行または空行が含まれる
- **THEN** それらの行は無視され、有効な `KEY=VALUE` 行のみがパースされる

#### Scenario: クォート付き値の処理

- **WHEN** `.env` ファイルの値がシングルクォートまたはダブルクォートで囲まれている（例： `KEY="value"` または `KEY='value'`）
- **THEN** クォートを除去した値がハッシュテーブルに格納される

### Requirement: 環境変数のパラメーター適用

`Apply-EnvSettings` 関数は、`.env` から読み込んだ設定値を、コマンドライン引数で明示指定されていないパラメーターにのみ適用しなければならない（SHALL）。

#### Scenario: コマンドライン引数が未指定の場合

- **WHEN** スクリプトのコマンドライン引数でパラメーターが明示指定されていない
- **AND** `.env` ファイルに該当する変数が定義されている
- **THEN** `.env` の値がパラメーターに適用される

#### Scenario: コマンドライン引数が指定済みの場合

- **WHEN** スクリプトのコマンドライン引数でパラメーターが明示指定されている
- **THEN** `.env` の値は無視され、コマンドライン引数の値が維持される

#### Scenario: .envに該当変数が存在しない場合

- **WHEN** `.env` ファイルに該当する変数が定義されていない
- **THEN** スクリプトのデフォルト値が使用される

### Requirement: AZURE\_プレフィックス付き変数命名

`.env` ファイル内のAzure関連環境変数は、`AZURE_` プレフィックス付きのUPPER_SNAKE_CASE形式で命名しなければならない（MUST）。

#### Scenario: Azure環境変数の命名

- **WHEN** Azure関連パラメーター（サブスクリプションID、リソースグループ名、ストレージアカウント名、リージョン）を `.env` で定義する
- **THEN** 以下の変数名が使用される： `AZURE_SUBSCRIPTION_ID`、`AZURE_RESOURCE_GROUP_NAME`、`AZURE_STORAGE_ACCOUNT_NAME`、`AZURE_LOCATION`

### Requirement: .env.exampleの更新

`.env.example` ファイルは、Azure関連の環境変数をコメント付きで含まなければならない（MUST）。

#### Scenario: .env.exampleにAzure変数が記載される

- **WHEN** 開発者が `.env.example` を参照する
- **THEN** 必要なAzure環境変数（`AZURE_SUBSCRIPTION_ID`、`AZURE_RESOURCE_GROUP_NAME`、`AZURE_STORAGE_ACCOUNT_NAME`、`AZURE_LOCATION`）がデフォルト値付きで記載されている

### Requirement: 全インフラスクリプトの.env対応

`scripts/infra/` 配下の全インフラスクリプトは、`Load-EnvSettings.ps1` をドットソースで読み込み、`.env` ファイルから設定を取得しなければならない（SHALL）。
対象： `Deploy-Infrastructure.ps1`、`Deploy-StaticFiles.ps1`、`Clear-Data.ps1`、`New-SasToken.ps1`、`Show-Urls.ps1`

#### Scenario: 各スクリプトが.envから設定を読み込む

- **WHEN** インフラスクリプトが実行される
- **AND** `.env` ファイルにAzure環境変数が定義されている
- **THEN** スクリプトは `Load-EnvSettings.ps1` 経由で `.env` から設定を読み込み、未指定のパラメーターに適用する

#### Scenario: local.settings.jsonからの読み込み機構の廃止

- **WHEN** インフラスクリプトが実行される
- **THEN** `Load-LocalSettings.ps1` および `local.settings.json` からの読み込みは行われない

### Requirement: .gitignoreの更新

`.gitignore` から `local.settings.json` 専用のエントリおよび関連コメントを削除しなければならない（MUST）。

#### Scenario: .gitignoreからlocal.settings.json関連エントリが削除される

- **WHEN** `.gitignore` ファイルを確認する
- **THEN** `local.settings.json` のエントリおよびその説明コメントが存在しない
