## Why

現在の `scripts/` 配下のインフラ操作スクリプトはすべてPowerShellで記述されており、macOS/Linux環境では実行できない。プロジェクトはReact + Vite + pnpmで構成されておりNode.jsは既に必須ランタイムであるため、追加のランタイム導入なしでクロスプラットフォーム対応が可能である。

## What Changes

- **BREAKING**: 全PowerShellスクリプト（`.ps1`）をNode.js ES Modules（`.mjs`）に置き換える
- **BREAKING**: `package.json` の `infra:*` スクリプトを `pwsh` から `node` コマンドに変更する
- `scripts/common/` を `scripts/lib/` に再構成し、共通ライブラリをESMモジュールとして提供する
- `az` CLI呼び出しを `child_process.execFile` で実行する
- IP検出にNode.js組込みの `fetch` を使用する
- .env読み込みに `dotenv` または自前パースを使用する
- ログ出力にANSIエスケープコードを使用する
- 旧PowerShellスクリプトを削除する

## Capabilities

### New Capabilities

- `node-infra-scripts`: 4つのメインスクリプト（deploy-static-files, clear-data, new-sas-token, show-urls）のNode.js ESM実装
- `node-common-libs`: 3つの共通ライブラリ（azure-storage, env-settings, logger）のNode.js ESMモジュール実装

### Modified Capabilities

- `env-path-argument`: `-EnvFile` PowerShellパラメータから `--env-file` CLIオプション（`process.argv` パース）に変更
- `infra-common-helpers`: PowerShell関数（Load-EnvSettings, Connect-AzureStorage, Write-Log）をNode.js ESMモジュールのエクスポート関数に置き換え

## Impact

- **コード**: `scripts/` 配下の全7ファイルを削除し、新規7ファイル（`.mjs`）を作成
- **依存関係**: 新規npm依存なし（Node.js組込みAPIのみ使用）。`dotenv` は任意
- **package.json**: `infra:*` スクリプト4件の変更
- **CI/CD**: PowerShell非依存になるため、GitHub Actionsワークフローの変更は不要（`node` は既に利用可能）
- **既存スペック**: `env-path-argument` と `infra-common-helpers` の要件をNode.js向けに更新
