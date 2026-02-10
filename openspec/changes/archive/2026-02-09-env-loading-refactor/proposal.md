## Why

現在の `scripts/` 配下のスクリプトは、Azure 関連パラメータ（`SubscriptionId`、`ResourceGroupName`、`StorageAccountName`）にハードコーディングされたデフォルト値を持つ。これにより、`.env` ファイルが未配置でもスクリプトが「なんとなく」動いてしまい、誤った環境に対して操作を実行するリスクがある。また、`.env` のパスが固定されているため、開発環境・本番環境など複数環境の切り替えに対応できない。

## What Changes

- **BREAKING**: 全スクリプトの `param()` ブロックから Azure 関連パラメータ（`SubscriptionId`, `ResourceGroupName`, `StorageAccountName`）を廃止。設定値は `.env` ファイルからのみ供給する
- **BREAKING**: `Load-EnvSettings` 関数の仕様変更。`.env` ファイルが存在しない場合は `$null` を返すのではなくエラーをスローする。`-EnvPath` パラメータを追加し、未指定時はプロジェクトルートの `.env` をデフォルトで利用する
- `Apply-EnvSettings` を廃止し、新関数 `Import-EnvParams` に統合。`.env` の全キーを呼び出し元スコープの変数として直接設定する。PascalCase ↔ SNAKE_CASE のマッピングを不要にする
- 各スクリプトで `.env` のキー名をそのまま変数として使用する（例: `$AZURE_SUBSCRIPTION_ID`）
- `.env.example` の `AZURE_LOCATION` など未使用項目の整理

## Capabilities

### New Capabilities

- `env-path-argument`: `.env` ファイルのパスをスクリプト引数 `-EnvFile` で指定できる機能。未指定時はプロジェクトルートの `.env` をデフォルトで利用する。明示指定・デフォルトを問わず、指定パスに `.env` が存在しない場合はエラーで終了する。これにより複数環境（開発・本番等）の切り替えを実現する

### Modified Capabilities

- `infra-common-helpers`: `.env` ファイルが存在しない場合の振る舞いを「`$null` を返す」から「エラーで終了」に変更。`Load-EnvSettings` に `-EnvPath` パラメータを追加。`Apply-EnvSettings` を廃止し `Import-EnvParams` に統合。各スクリプトの Azure 関連パラメータを廃止し、`.env` のキー名を直接変数として使用

## Impact

- **影響ファイル**:
  - `scripts/common/Load-EnvSettings.ps1` — `Apply-EnvSettings` 廃止、`Import-EnvParams` 新設、`Load-EnvSettings` に `-EnvPath` 追加
  - `scripts/Clear-Data.ps1` — Azure パラメータ廃止、`Import-EnvParams` 呼び出し、変数名変更
  - `scripts/Deploy-StaticFiles.ps1` — 同上
  - `scripts/New-SasToken.ps1` — 同上
  - `scripts/Show-Urls.ps1` — 同上
  - `scripts/common/Connect-AzureStorage.ps1` — 引数の変数名変更に伴う呼び出し側の対応
  - `.env.example` — 不要項目の整理
- **破壊的変更**: `.env` ファイルなしでのスクリプト実行ができなくなる。`-SubscriptionId` 等のコマンドライン引数による個別上書きも廃止
- **依存関係**: 外部依存の変更なし。PowerShell 共通関数のインターフェース変更のみ
