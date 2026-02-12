## MODIFIED Requirements

### Requirement: .env設定読み込み関数の提供

`scripts/common/Load-EnvSettings.ps1` は `Load-EnvSettings` 関数を提供しなければならない（SHALL）。`Load-EnvSettings` は `-EnvPath` パラメーターを受け付け、未指定時はプロジェクトルートの `.env` をデフォルトとして使用する。指定パスに `.env` ファイルが存在しない場合はエラーをスローしなければならない（MUST）。`Apply-EnvSettings` 関数は廃止し、`Import-EnvParams` に統合する。

#### Scenario: .envファイルが存在する場合の読み込み

- **WHEN** 指定パス（またはデフォルトのプロジェクトルート `.env`）にファイルが存在する
- **THEN** `Load-EnvSettings` はファイル内の `KEY=VALUE` 形式の行をパースし、キーと値のハッシュテーブルを返す

#### Scenario: .envファイルが存在しない場合

- **WHEN** 指定パス（またはデフォルトのプロジェクトルート `.env`）にファイルが存在しない
- **THEN** `Load-EnvSettings` はファイルパスを含むエラーメッセージと共に例外をスローする

#### Scenario: -EnvPath による任意パス指定

- **WHEN** `Load-EnvSettings -EnvPath "C:\envs\.env.prod"` のようにパスを指定する
- **THEN** 指定されたパスの `.env` ファイルが読み込まれる

### Requirement: 既存スクリプトの共通関数への移行

既存の4スクリプト（Clear-Data, Deploy-StaticFiles, New-SasToken, Show-Urls）は、Azure パラメーター（`SubscriptionId`, `ResourceGroupName`, `StorageAccountName`）を `param()` から廃止しなければならない（MUST）。`-EnvFile` パラメーターを追加し、`.env` 読み込み処理を `Import-EnvParams` の呼び出しに置き換えなければならない（MUST）。スクリプト内では `.env` のキー名をそのまま変数名として使用する（例： `$AZURE_SUBSCRIPTION_ID`）。

#### Scenario: Azure パラメーターの廃止

- **WHEN** スクリプトの `param()` ブロックを確認する
- **THEN** `SubscriptionId`、`ResourceGroupName`、`StorageAccountName` パラメーターが存在しない

#### Scenario: .env 未配置での実行

- **WHEN** `.env` ファイルが存在しない状態でスクリプトを実行する
- **THEN** `.env` ファイルが見つからない旨のエラーメッセージと共にスクリプトが終了する

#### Scenario: .env からの変数利用

- **WHEN** `.env` に `AZURE_SUBSCRIPTION_ID=xxx` が設定された状態でスクリプトを実行する
- **THEN** スクリプト内で `$AZURE_SUBSCRIPTION_ID` として値が利用可能であり、`Connect-AzureStorage` に渡される

#### Scenario: .env読み込みと共通関数の併用

- **WHEN** スクリプトが実行される
- **THEN** Import-EnvParams → Connect-AzureStorage の順で処理が実行される

## REMOVED Requirements

### Requirement: コマンドライン引数が未指定のパラメーターへの.env値の適用

**Reason**: `Apply-EnvSettings` 関数を廃止。`.env` のキー名をそのまま変数として設定する `Import-EnvParams` に統合したため、PascalCase ↔ SNAKE_CASE のマッピングと `BoundParameters` による上書き判定が不要になった。
**Migration**: `Apply-EnvSettings` の呼び出しを `Import-EnvParams` に置き換える。スクリプト内の変数参照を `.env` のキー名に変更する（例： `$SubscriptionId` → `$AZURE_SUBSCRIPTION_ID`）。
