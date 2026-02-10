## MODIFIED Requirements

### Requirement: .env設定読み込み関数の提供
`scripts/lib/env-settings.mjs` は `loadEnvSettings` 関数をnamed exportとして提供しなければならない（SHALL）。`loadEnvSettings` はオプションのパス引数を受け付け、未指定時はプロジェクトルートの `.env` をデフォルトとして使用する。指定パスに `.env` ファイルが存在しない場合はエラーをスローしなければならない（MUST）。

#### Scenario: .envファイルが存在する場合の読み込み
- **WHEN** 指定パス（またはデフォルトのプロジェクトルート `.env`）にファイルが存在する
- **THEN** `loadEnvSettings` はファイル内の `KEY=VALUE` 形式の行をパースし、キーと値のオブジェクトを返す

#### Scenario: .envファイルが存在しない場合
- **WHEN** 指定パス（またはデフォルトのプロジェクトルート `.env`）にファイルが存在しない
- **THEN** `loadEnvSettings` はファイルパスを含むエラーメッセージと共に例外をスローする

#### Scenario: パス引数による任意パス指定
- **WHEN** `loadEnvSettings("/path/to/.env.prod")` のようにパスを指定する
- **THEN** 指定されたパスの `.env` ファイルが読み込まれる

### Requirement: Azure Storage接続関数の提供
`scripts/lib/azure-storage.mjs` は `connectAzureStorage` 関数をnamed exportとして提供しなければならない（SHALL）。この関数はAzureサブスクリプション切替・Storageアカウント接続確認・アカウントキー取得を一括で実行し、アカウントキーを返す。

#### Scenario: Azure Storageへの正常接続
- **WHEN** 有効な `subscriptionId`、`resourceGroupName`、`storageAccountName` を指定して `connectAzureStorage` を呼び出す
- **THEN** サブスクリプションが切り替わり、Storageアカウントの存在が確認され、アカウントキーが返される

#### Scenario: サブスクリプション切替の失敗
- **WHEN** 無効な `subscriptionId` を指定して `connectAzureStorage` を呼び出す
- **THEN** エラーメッセージ付きの例外がスローされる

#### Scenario: Storageアカウントが見つからない場合
- **WHEN** 存在しない `storageAccountName` を指定して `connectAzureStorage` を呼び出す
- **THEN** エラーメッセージ付きの例外がスローされる

#### Scenario: アカウントキー取得の失敗
- **WHEN** アカウントキーの取得に失敗した場合
- **THEN** エラーメッセージ付きの例外がスローされる

### Requirement: 共通ライブラリの配置場所
共通ライブラリは `scripts/lib/` ディレクトリにES Modules（`.mjs`）として配置しなければならない（MUST）。各スクリプトは `import` 文で相対パスから読み込む。

#### Scenario: スクリプトからの共通ライブラリ読み込み
- **WHEN** `scripts/` 直下のスクリプトが共通ライブラリを使用する
- **THEN** `import { func } from './lib/module.mjs'` の形式でインポートする

### Requirement: 既存スクリプトの共通ライブラリへの移行
既存の4スクリプト（clear-data, deploy-static-files, new-sas-token, show-urls）は、Azure接続パラメータを `importEnvParams` から取得したオブジェクトのプロパティとして使用しなければならない（MUST）。

#### Scenario: .env からの変数利用
- **WHEN** `.env` に `AZURE_SUBSCRIPTION_ID=xxx` が設定された状態でスクリプトを実行する
- **THEN** スクリプト内で `env.AZURE_SUBSCRIPTION_ID` として値が利用可能であり、`connectAzureStorage` に渡される

#### Scenario: env読み込みとAzure接続の併用
- **WHEN** スクリプトが実行される
- **THEN** `importEnvParams` → `connectAzureStorage` の順で処理が実行される
