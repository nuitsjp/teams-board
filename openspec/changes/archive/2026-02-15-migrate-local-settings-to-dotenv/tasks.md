## 1. ヘルパーモジュールの作成

- [x] 1.1 `Load-LocalSettings.ps1` を `Load-EnvSettings.ps1` にリネームする
- [x] 1.2 `Load-EnvSettings` 関数を実装する（`.env` ファイルのパース：KEY=VALUE形式、コメント・空行スキップ、クォート除去）
- [x] 1.3 `Apply-EnvSettings` 関数を実装する（`Apply-LocalSettings` から改名し、パラメータマッピングを `.env` 変数名に対応させる）

## 2. インフラスクリプトの更新

- [x] 2.1 `Deploy-Infrastructure.ps1` のドットソース行と設定読み込み部を `Load-EnvSettings.ps1` / `Load-EnvSettings` / `Apply-EnvSettings` に変更し、`ParameterMap` のキーを `AZURE_*` 形式に更新する
- [x] 2.2 `Deploy-StaticFiles.ps1` のドットソース行と設定読み込み部を同様に更新する
- [x] 2.3 `Clear-Data.ps1` のドットソース行と設定読み込み部を同様に更新する
- [x] 2.4 `New-SasToken.ps1` のドットソース行と設定読み込み部を同様に更新する
- [x] 2.5 `Show-Urls.ps1` のドットソース行と設定読み込み部を同様に更新する

## 3. 設定ファイルの更新

- [x] 3.1 `.env.example` に Azure 環境変数（`AZURE_SUBSCRIPTION_ID`、`AZURE_RESOURCE_GROUP_NAME`、`AZURE_STORAGE_ACCOUNT_NAME`、`AZURE_LOCATION`）をデフォルト値付きで追加する
- [x] 3.2 `.gitignore` から `local.settings.json` のエントリおよび関連コメントを削除する

## 4. クリーンアップ

- [x] 4.1 `Load-LocalSettings.ps1` ファイルを削除する
