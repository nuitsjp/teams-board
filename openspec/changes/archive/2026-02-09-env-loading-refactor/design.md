## Context

現在の `scripts/` 配下の4つのメインスクリプト（Clear-Data, Deploy-StaticFiles, New-SasToken, Show-Urls）は、Azure 関連パラメータに本番環境のハードコーディングされたデフォルト値を持つ。`.env` の読み込み → 適用 → 変数設定のボイラープレートが各スクリプトで重複しており、PascalCase ↔ SNAKE_CASE のマッピングテーブルも冗長である。`.env` ファイルパスはプロジェクトルート固定で複数環境の切り替えができない。

## Goals / Non-Goals

**Goals:**
- 各スクリプトの `param()` から Azure パラメータを廃止し、`.env` ファイルを唯一の設定ソースにする
- `.env` ファイルが見つからない場合、明確なエラーメッセージで終了する
- `-EnvFile` 引数で `.env` ファイルパスを指定可能にする（デフォルト: プロジェクトルートの `.env`）
- `.env` のキー名をそのまま変数名として使用し、PascalCase ↔ SNAKE_CASE マッピングを廃止する
- `.env` 読み込み → 変数設定 → 必須キー検証を共通関数1回の呼び出しに集約する

**Non-Goals:**
- `.env` 以外の設定ファイル形式（YAML, JSON 等）のサポート
- 環境変数（`$env:`）からの読み込み対応
- スクリプト固有パラメータ（`PolicyName`, `SourcePaths` 等）のデフォルト値変更

## Decisions

### 1. `-EnvFile` パラメータの導入方法

**決定**: 各スクリプトの `param()` に `-EnvFile` パラメータのみを残す（スクリプト固有パラメータは除く）。デフォルト値は空文字列とし、`Import-EnvParams` 内で空の場合はプロジェクトルートの `.env` に解決する。

**利用例**:
```powershell
# デフォルト（プロジェクトルートの .env を利用）
./scripts/Clear-Data.ps1

# 別環境の .env を指定
./scripts/Clear-Data.ps1 -EnvFile ".env.staging"
```

### 2. `Load-EnvSettings` のエラー処理変更

**決定**: `.env` ファイルが見つからない場合、`$null` を返す代わりに `throw` でエラー終了する。`-EnvPath` パラメータを追加し、空文字列の場合はプロジェクトルートの `.env` をデフォルトとして使用する。

**理由**: `.env` が唯一の設定ソースになるため、存在しない場合は処理を続行できない。早い段階で明確なエラーを出す方がデバッグしやすい。

### 3. ボイラープレートの集約方法

**決定**: `Apply-EnvSettings` を廃止し、新関数 `Import-EnvParams` に統合する。この関数は `.env` の全キーを `Set-Variable -Scope 1` で呼び出し元スコープに直接設定する。必須キーの検証は `.env.example` をスキーマ定義として使用し、呼び出し側での指定は不要。

**現在のパターン**（各スクリプトで 7 行 + param 3 行）:
```powershell
param(
    [string]$SubscriptionId = "9f8bb535-...",
    [string]$ResourceGroupName = "z2-rg-...",
    [string]$StorageAccountName = "strjstudylogprod"
)
$envSettings = Load-EnvSettings
$applied = Apply-EnvSettings -Settings $envSettings -BoundParameters $PSBoundParameters -ParameterMap @{
    "SubscriptionId"     = "AZURE_SUBSCRIPTION_ID"
    "ResourceGroupName"  = "AZURE_RESOURCE_GROUP_NAME"
    "StorageAccountName" = "AZURE_STORAGE_ACCOUNT_NAME"
}
foreach ($key in $applied.Keys) {
    Set-Variable -Name $key -Value $applied[$key]
}
Connect-AzureStorage -SubscriptionId $SubscriptionId ...
```

**変更後のパターン**（1 呼び出しのみ）:
```powershell
param(
    [string]$EnvFile = ""
)
Import-EnvParams -EnvPath $EnvFile
Connect-AzureStorage -SubscriptionId $AZURE_SUBSCRIPTION_ID ...
```

`Import-EnvParams` 内部で以下を実行:
1. `Load-EnvSettings -EnvPath $EnvPath` で `.env` を読み込み
2. 全キーを `Set-Variable -Name $key -Value $value -Scope 1` で呼び出し元スコープに設定
3. プロジェクトルートの `.env.example` をパースし、そこに定義されたキーが `.env` にすべて存在するか検証。不足があれば不足キー名を列挙してエラー

**`.env.example` をスキーマ定義として使用する理由**: 必須キーは `.env` ファイルの仕様であり、呼び出し元スクリプトの都合ではない。`.env.example` は既にプロジェクトに存在し、期待されるキー一覧を定義している。新しいキーが増えた場合も `.env.example` を更新するだけで全スクリプトの検証に反映される。

### 4. `PolicyName` のデフォルト値の扱い

**決定**: `PolicyName` のデフォルト値 `"dashboard-admin"` は維持する。これは環境依存の値ではなく、アプリケーションのロジカル名であるため、`.env` 管理の対象外。スクリプト固有パラメータとして `param()` に残す。

### 5. `-EnvPath` のパス解決

**決定**: `-EnvPath` が相対パスの場合、プロジェクトルート基準で解決する。絶対パスの場合はそのまま使用する。

```
-EnvFile ""             → {プロジェクトルート}/.env
-EnvFile ".env.prod"    → {プロジェクトルート}/.env.prod
-EnvFile "C:\envs\.env" → C:\envs\.env（絶対パスはそのまま）
```

## Risks / Trade-offs

- **[破壊的変更] コマンドライン引数での個別上書き廃止** → 環境の切り替えは `-EnvFile` でファイル単位で行う方式に一本化。個別パラメータ上書きの利便性は失われるが、設定値の管理が `.env` ファイルに一元化されて明確になる
- **[破壊的変更] `.env` 未配置時の動作変更** → エラーメッセージに `.env.example からコピーしてください` の旨を含める
- **[変数名の変更]** スクリプト内の変数名が `$SubscriptionId` → `$AZURE_SUBSCRIPTION_ID` に変わる → `Connect-AzureStorage` への引数渡しなど、全参照箇所の更新が必要
- **[スコープの安全性]** `Set-Variable -Scope 1` はドットソースで読み込んだ関数から呼び出した場合でも、関数の呼び出し元スコープ（=スクリプトスコープ）に設定される。全スクリプトで一貫した呼び出しパターンのため問題なし
