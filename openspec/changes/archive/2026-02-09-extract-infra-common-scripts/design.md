## Context

`scripts/infra/` 配下に5つのPowerShellスクリプトが存在し、それぞれが以下の処理を個別に実装している：

1. `.env` ファイルの読み込みと適用（Load-EnvSettings / Apply-EnvSettings）
2. Azureサブスクリプション切替（`az account set`）
3. Storageアカウント接続確認（`az storage account show`）
4. アカウントキー取得（`az storage account keys list`）

現在の構造：

```
scripts/
└── infra/
    ├── Clear-Data.ps1
    ├── Deploy-Infrastructure.ps1
    ├── Deploy-StaticFiles.ps1
    ├── Load-EnvSettings.ps1
    ├── New-SasToken.ps1
    └── Show-Urls.ps1
```

`scripts/` 配下には `infra/` しか存在せず、この階層は不要である。各スクリプトは `Load-EnvSettings.ps1` をドットソースで読み込み、Azure接続処理は同一パターンのコードを個々にコピーしている。

## Goals / Non-Goals

**Goals:**

- `scripts/infra/` の `infra` 階層を廃止し、全スクリプトを `scripts/` 直下に引き上げる
- 共通処理を `scripts/common/` サブフォルダーに集約し、重複コードを排除する
- 各スクリプトのパラメータインターフェイス（外部呼び出しの互換性）を維持する
- 共通関数を呼び出すだけで .env読み込み → Azure接続 → アカウントキー取得が完了する構成にする

**Non-Goals:**

- 各スクリプト固有のビジネスロジックの変更やリファクタリング
- パラメーターのデフォルト値の変更
- 新しいインフラスクリプトの追加

## Decisions

### 1. ファイル構成：`infra` 階層の廃止と `scripts/common/` サブフォルダーの新設

**決定**: `scripts/infra/` の全スクリプトを `scripts/` 直下に移動し、共通関数を `scripts/common/` に配置する

```
scripts/
├── common/
│   ├── Load-EnvSettings.ps1    （既存ファイルを移動）
│   └── Connect-AzureStorage.ps1（新規：Azure接続共通関数）
├── Clear-Data.ps1
├── Deploy-Infrastructure.ps1
├── Deploy-StaticFiles.ps1
├── New-SasToken.ps1
└── Show-Urls.ps1
```

**理由**: `scripts/infra/` は唯一のサブフォルダーで階層に意味がない。フラット化により参照パスが簡潔になる。`common/` は共通処理の格納先として目的が明確。モジュール化（.psm1）は現在のスクリプト規模では過剰。

**代替案**: `lib/` や `helpers/` も検討したが、`common/` がもっとも直感的。

### 2. Azure接続処理の関数化：`Connect-AzureStorage` 関数

**決定**: サブスクリプション切替・Storageアカウント接続確認・アカウントキー取得を1つの関数 `Connect-AzureStorage` にまとめる

```powershell
function Connect-AzureStorage {
    param(
        [Parameter(Mandatory)][string]$SubscriptionId,
        [Parameter(Mandatory)][string]$ResourceGroupName,
        [Parameter(Mandatory)][string]$StorageAccountName
    )
    # サブスクリプション切替
    # Storageアカウント接続確認
    # アカウントキー取得
    # → アカウントキーを返す
}
```

**理由**: 5スクリプト中4つ（Deploy-Infrastructure含む）で同一の3ステップが連続して実行されている。1関数にまとめることで呼び出し側が1行で済む。

**代替案**: 各ステップを個別関数にする案もあるが、常にセットで使われるため過分割になる。

### 3. ドットソースパスの更新

**決定**: 各スクリプトのドットソースパスを `scripts/` 直下基準に更新する

変更前（`scripts/infra/` 基準）：

```powershell
. (Join-Path $PSScriptRoot "Load-EnvSettings.ps1")
```

変更後（`scripts/` 基準）：

```powershell
. (Join-Path $PSScriptRoot "common" "Load-EnvSettings.ps1")
. (Join-Path $PSScriptRoot "common" "Connect-AzureStorage.ps1")
```

**理由**: スクリプト本体と共通処理が同じ親ディレクトリ配下となり、パス解決が直感的になる。

### 4. Load-EnvSettings.ps1 のプロジェクトルート算出の修正

**決定**: `$PSScriptRoot` 基準のプロジェクトルート算出ロジックを修正する

変更前（`scripts/infra/` → 2階層上）：

```powershell
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
```

変更後（`scripts/common/` → 2階層上、階層数は同じだが意味が変わる）：

```powershell
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
```

**理由**: `scripts/infra/` → `scripts/common/` で階層数が同じ（2階層上）のため、ロジック自体は変更不要。ただしコメントを更新する。

### 5. .env適用パターンの維持

**決定**: .env の読み込み・適用パターン（Load-EnvSettings → Apply-EnvSettings → Set-Variable ループ）はそのまま維持する。共通関数化しない。

**理由**: 各スクリプトの `ParameterMap` が異なる（Deploy-Infrastructure は `Location` パラメーターも持つ）ため、共通化すると柔軟性が失われる。現在のパターンは3行で十分簡潔。

## Risks / Trade-offs

- **[スクリプトパス変更による外部参照の破損]** → `scripts/infra/*.ps1` を参照している箇所（ドキュメント、CI/CD設定など）のパスを `scripts/*.ps1` に更新する必要がある。プロジェクト内の参照箇所を検索して漏れなく修正する。
- **[既存スクリプトの一括修正]** → 5スクリプトすべてのドットソースパスを同時に変更する必要がある。1ファイルでも漏れると実行時エラーになる。全スクリプトの動作確認で検証する。
- **[git履歴の分断]** → ファイル移動により `git log --follow` が必要になる。影響は軽微。
