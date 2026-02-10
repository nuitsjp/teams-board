## MODIFIED Requirements

### Requirement: スクリプトの -EnvFile パラメータ

全メインスクリプト（clear-data, deploy-static-files, new-sas-token, show-urls）は `--env-file` CLIオプションを受け付けなければならない（SHALL）。このオプションにより、使用する `.env` ファイルのパスを指定できる。未指定時はプロジェクトルートの `.env` をデフォルトとして使用する。

#### Scenario: --env-file 未指定時のデフォルト動作

- **WHEN** `--env-file` を指定せずにスクリプトを実行する
- **THEN** プロジェクトルートの `.env` ファイルが読み込まれる

#### Scenario: --env-file で相対パスを指定

- **WHEN** `--env-file .env.staging` のように相対パスを指定してスクリプトを実行する
- **THEN** プロジェクトルート基準で解決されたパスの `.env` ファイルが読み込まれる

#### Scenario: --env-file で絶対パスを指定

- **WHEN** `--env-file /path/to/.env.prod` のように絶対パスを指定してスクリプトを実行する
- **THEN** 指定された絶対パスの `.env` ファイルが読み込まれる

#### Scenario: 指定された .env ファイルが存在しない場合

- **WHEN** `--env-file` で指定されたパス（またはデフォルトパス）に `.env` ファイルが存在しない
- **THEN** ファイルパスを含む明確なエラーメッセージと共にスクリプトが終了する

### Requirement: Import-EnvParams 共通関数の提供

`scripts/lib/env-settings.mjs` は `importEnvParams` 関数をnamed exportとして提供しなければならない（SHALL）。この関数は `.env` ファイルの読み込み、全キーのオブジェクトとしての返却、`.env.example` に基づく必須キーの検証を一括で実行する。

#### Scenario: importEnvParams による .env キーのオブジェクト返却

- **WHEN** `importEnvParams(envFile)` を呼び出す
- **THEN** `.env` の全キーがプロパティとして設定されたオブジェクトが返される（例: `AZURE_SUBSCRIPTION_ID=xxx` → `env.AZURE_SUBSCRIPTION_ID` が利用可能になる）

#### Scenario: .env.example に基づく必須キーの検証

- **WHEN** `.env.example` に定義されたキーが `.env` に存在しない
- **THEN** 不足しているキー名を含むエラーメッセージと共に例外がスローされる

#### Scenario: .env.example が存在しない場合

- **WHEN** プロジェクトルートに `.env.example` が存在しない
- **THEN** 必須キー検証はスキップされ、`.env` の全キーがオブジェクトとして返される
