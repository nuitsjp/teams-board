## 1. 共通関数ファイルの作成

- [x] 1.1 `scripts/common/` ディレクトリを作成する
- [x] 1.2 `scripts/infra/Load-EnvSettings.ps1` を `scripts/common/Load-EnvSettings.ps1` に移動し、コメント内のパス説明（`scripts/infra → プロジェクトルート`）を `scripts/common → プロジェクトルート` に更新する
- [x] 1.3 `scripts/common/Connect-AzureStorage.ps1` を新規作成する。既存スクリプトから共通のAzure接続処理（サブスクリプション切替・Storageアカウント接続確認・アカウントキー取得）を抽出し、`Connect-AzureStorage` 関数として実装する

## 2. スクリプトの移動とリファクタリング

- [x] 2.1 `scripts/infra/Clear-Data.ps1` を `scripts/Clear-Data.ps1` に移動し、ドットソースパスを `common/Load-EnvSettings.ps1` と `common/Connect-AzureStorage.ps1` に変更し、Azure接続の重複コードを `Connect-AzureStorage` 関数呼び出しに置き換える
- [x] 2.2 `scripts/infra/Deploy-StaticFiles.ps1` を `scripts/Deploy-StaticFiles.ps1` に移動し、ドットソースパスを変更し、Azure接続の重複コードを `Connect-AzureStorage` 関数呼び出しに置き換える。リポジトリルート算出コメント（`scripts/infra から2階層上`）を `scripts/ から1階層上` に更新する
- [x] 2.3 `scripts/infra/New-SasToken.ps1` を `scripts/New-SasToken.ps1` に移動し、ドットソースパスを変更し、Azure接続の重複コードを `Connect-AzureStorage` 関数呼び出しに置き換える
- [x] 2.4 `scripts/infra/Show-Urls.ps1` を `scripts/Show-Urls.ps1` に移動し、ドットソースパスを変更し、Azure接続の重複コードを `Connect-AzureStorage` 関数呼び出しに置き換える
- [x] 2.5 `scripts/infra/Deploy-Infrastructure.ps1` を `scripts/Deploy-Infrastructure.ps1` に移動し、ドットソースパスを変更する（Deploy-InfrastructureはStorageアカウントの作成/更新を行うプロビジョニングスクリプトのため、Connect-AzureStorageの適用は不適切と判断しドットソースパスのみ更新）

## 3. 旧ディレクトリの削除

- [x] 3.1 `scripts/infra/` ディレクトリが空であることを確認し、削除する

## 4. プロジェクト内参照パスの更新

- [x] 4.1 `package.json` の npmスクリプト5箇所（infra:deploy, infra:publish, infra:sas, infra:clear, infra:urls）のパスを `scripts/infra/` → `scripts/` に更新する
- [x] 4.2 `docs/architecture.md` のスクリプトパス参照4箇所を `scripts/infra/` → `scripts/` に更新する
