## Why

`scripts/infra/` 配下の5つのPowerShellスクリプト（Clear-Data, Deploy-StaticFiles, New-SasToken, Show-Urls, Deploy-Infrastructure）に、.env読み込み・Azureサブスクリプション切替・Storageアカウント接続確認・アカウントキー取得の同一コードが重複している。修正時に全スクリプトを同期更新する必要があり、保守コストが高い。また、`scripts/infra/` は `scripts/` 配下の唯一のサブフォルダであり、`infra` 階層は不要である。スクリプトを `scripts/` 直下に引き上げ、共通処理を専用のサブフォルダに分離し、DRY原則に従った構成にする。

## What Changes

- `scripts/infra/` 配下の全スクリプトを `scripts/` 直下に移動し、`infra` 階層を廃止する
- `scripts/common/` サブフォルダを新設し、共通ヘルパー関数を集約する
- `Load-EnvSettings.ps1` を `scripts/common/` に移動する
- Azure接続処理（サブスクリプション切替・Storageアカウント接続確認・アカウントキー取得）を共通関数化し `scripts/common/` に配置する
- 既存の5スクリプト（Clear-Data, Deploy-StaticFiles, New-SasToken, Show-Urls, Deploy-Infrastructure）のドットソースパスと重複コードを共通関数呼び出しに置き換える
- **BREAKING**: 全スクリプトのパスが `scripts/infra/*.ps1` → `scripts/*.ps1` に変更される

## Capabilities

### New Capabilities

- `infra-common-helpers`: インフラスクリプト共通ヘルパー関数群。.env設定読み込み（Load-EnvSettings / Apply-EnvSettings）、Azureサブスクリプション切替、Storageアカウント接続確認、アカウントキー取得を提供する

### Modified Capabilities

（既存のopenspec/specsなし）

## Impact

- **対象コード**: `scripts/infra/` 配下の全PowerShellスクリプト（5ファイル + Load-EnvSettings.ps1）
- **ディレクトリ移動**: `scripts/infra/*.ps1` → `scripts/*.ps1`（infra階層の廃止）
- **共通処理移動**: `scripts/infra/Load-EnvSettings.ps1` → `scripts/common/Load-EnvSettings.ps1`
- **新規ファイル**: `scripts/common/Connect-AzureStorage.ps1`（Azure接続共通関数）
- **ディレクトリ削除**: `scripts/infra/`（移動完了後に削除）
- **依存関係**: 各スクリプトのパスが変更されるため、スクリプトを個別に呼び出している外部ワークフロー（CI/CDなど）のパス参照を更新する必要がある（パラメータインターフェースは不変）
- **対象外**: `generate-dummy-data.sh` は削除済みのため対象外
