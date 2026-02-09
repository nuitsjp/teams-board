## ADDED Requirements

### Requirement: スクリプトの -EnvFile パラメータ
全メインスクリプト（Clear-Data, Deploy-StaticFiles, New-SasToken, Show-Urls）は `-EnvFile` パラメータを受け付けなければならない（SHALL）。このパラメータにより、使用する `.env` ファイルのパスを指定できる。未指定時はプロジェクトルートの `.env` をデフォルトとして使用する。

#### Scenario: -EnvFile 未指定時のデフォルト動作
- **WHEN** `-EnvFile` を指定せずにスクリプトを実行する
- **THEN** プロジェクトルートの `.env` ファイルが読み込まれる

#### Scenario: -EnvFile で相対パスを指定
- **WHEN** `-EnvFile ".env.staging"` のように相対パスを指定してスクリプトを実行する
- **THEN** プロジェクトルート基準で解決されたパスの `.env` ファイルが読み込まれる

#### Scenario: -EnvFile で絶対パスを指定
- **WHEN** `-EnvFile "C:\envs\.env.prod"` のように絶対パスを指定してスクリプトを実行する
- **THEN** 指定された絶対パスの `.env` ファイルが読み込まれる

#### Scenario: 指定された .env ファイルが存在しない場合
- **WHEN** `-EnvFile` で指定されたパス（またはデフォルトパス）に `.env` ファイルが存在しない
- **THEN** ファイルパスを含む明確なエラーメッセージと共にスクリプトが終了する

### Requirement: Import-EnvParams 共通関数の提供
`scripts/common/Load-EnvSettings.ps1` は `Import-EnvParams` 関数を提供しなければならない（SHALL）。この関数は `.env` ファイルの読み込み、全キーの呼び出し元スコープへの変数設定、`.env.example` に基づく必須キーの検証を一括で実行する。

#### Scenario: Import-EnvParams による .env キーの変数設定
- **WHEN** `Import-EnvParams -EnvPath $EnvFile` を呼び出す
- **THEN** `.env` の全キーが `Set-Variable -Scope 1` で呼び出し元スコープの変数として設定される（例: `AZURE_SUBSCRIPTION_ID=xxx` → `$AZURE_SUBSCRIPTION_ID` が利用可能になる）

#### Scenario: .env.example に基づく必須キーの検証
- **WHEN** `.env.example` に定義されたキーが `.env` に存在しない
- **THEN** 不足しているキー名を含むエラーメッセージと共にスクリプトが終了する

#### Scenario: .env.example が存在しない場合
- **WHEN** プロジェクトルートに `.env.example` が存在しない
- **THEN** 必須キー検証はスキップされ、`.env` の全キーが変数として設定される
