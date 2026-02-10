## Why

現在、Azureの環境固有パラメータ（サブスクリプションID、リソースグループ名、ストレージアカウント名など）は `local.settings.json` というJSON形式で管理されている。一方、フロントエンド用の環境変数は `.env` / `.env.example` で管理されている。環境情報の管理が2系統に分かれており、設定の見通しが悪い。`.env` ファイルに統合することで、環境設定を一元管理し、開発者体験を改善する。

## What Changes

- **BREAKING**: `local.settings.json` による設定読み込み機構を廃止し、`.env` ファイルからの読み込みに置き換える
- `Load-LocalSettings.ps1`（JSON読み込みヘルパー）を `.env` 形式の読み込みヘルパーに書き換える
- 全インフラスクリプト（`Deploy-Infrastructure.ps1`、`Deploy-StaticFiles.ps1`、`Clear-Data.ps1`、`New-SasToken.ps1`、`Show-Urls.ps1`）の設定読み込み部分を `.env` 対応に変更する
- `.env.example` に Azure 関連の環境変数を追加する
- `.gitignore` から `local.settings.json` のエントリを削除する（`.env` は既に対象）

## Capabilities

### New Capabilities
- `dotenv-config-loader`: `.env` ファイルからインフラスクリプト用の環境変数を読み込む共通ヘルパー機能

### Modified Capabilities
（既存のspecsにこの変更に該当するものはなし）

## Impact

- **インフラスクリプト**: `scripts/infra/` 配下の全5スクリプト＋ヘルパー1ファイルが変更対象
- **設定ファイル**: `.env.example` へのAzure環境変数の追加、`.gitignore` の更新
- **開発者ワークフロー**: `local.settings.json` を使用している開発者は `.env` ファイルへの移行が必要（**BREAKING**）
- **フロントエンドコード**: 変更なし（既に `import.meta.env` 経由で `.env` を使用済み）
