## Context

プロジェクトはReact + Vite + pnpm構成で、インフラ操作用に7つのPowerShellスクリプトを `scripts/` 配下に持つ。これらはAzure Blob Storageへの静的ファイルデプロイ、データクリア、SASトークン生成、URL表示を行う。Node.jsは既に必須ランタイムであるため、PowerShell依存を排除してクロスプラットフォーム対応を実現する。

現在のファイル構成:
- `scripts/Deploy-StaticFiles.ps1` - テスト・ビルド・デプロイ
- `scripts/Clear-Data.ps1` - Blobデータクリア
- `scripts/New-SasToken.ps1` - SASトークン生成
- `scripts/Show-Urls.ps1` - URL表示
- `scripts/common/Write-Log.ps1` - ログ出力ユーティリティ
- `scripts/common/Load-EnvSettings.ps1` - .env読み込み
- `scripts/common/Connect-AzureStorage.ps1` - Azure接続

## Goals / Non-Goals

**Goals:**
- 全PowerShellスクリプトをNode.js ESM（`.mjs`）に1:1で置き換える
- `package.json` の `infra:*` スクリプトを `node` コマンドに変更する
- 既存の動作・出力を忠実に再現する
- 追加のnpm依存を最小限にする（可能な限りNode.js組込みAPIを使用）

**Non-Goals:**
- スクリプトの機能追加や仕様変更（移行のみ）
- CI/CDワークフローの変更
- テストの追加（インフラスクリプトは手動実行前提）
- Azure CLIの `az` コマンド自体の置き換え

## Decisions

### D1: `az` CLI呼び出しに `child_process.execFile` を使用
**決定**: `child_process.execFile` をPromiseラップして使用する。
**理由**: シェルインジェクションのリスクがない。`az` CLIはパス上に存在する前提で、引数を配列で渡す。
**代替案**: `execa` パッケージ → 外部依存を増やすため不採用。

### D2: .envパースは自前実装
**決定**: 既存のPowerShellと同等のパースロジックを自前実装する。
**理由**: 現在のLoad-EnvSettingsと完全互換の動作を保証する。`KEY=VALUE` 形式、コメント行、クォート除去のみで十分シンプル。
**代替案**: `dotenv` パッケージ → 追加依存なしで実現可能なため不採用。

### D3: ログ出力はANSIエスケープコードで実装
**決定**: Node.js標準の `console.log` + ANSIエスケープコードで色分け出力する。
**理由**: PowerShellの `Write-Host -ForegroundColor` と同等の出力を追加依存なしで実現。
**代替案**: `chalk` パッケージ → 追加依存なしで実現可能なため不採用。

### D4: `--env-file` CLIオプションの実装
**決定**: `process.argv` を直接パースして `--env-file` オプションを取得する。
**理由**: 引数が1つのみで単純。PowerShellの `-EnvFile` パラメータと同等の機能。
**代替案**: `commander` / `yargs` パッケージ → 過剰な依存のため不採用。

### D5: ファイル構成
**決定**:
```
scripts/
  deploy-static-files.mjs    ← Deploy-StaticFiles.ps1
  clear-data.mjs              ← Clear-Data.ps1
  new-sas-token.mjs           ← New-SasToken.ps1
  show-urls.mjs               ← Show-Urls.ps1
  lib/
    azure-storage.mjs          ← common/Connect-AzureStorage.ps1
    env-settings.mjs           ← common/Load-EnvSettings.ps1
    logger.mjs                 ← common/Write-Log.ps1
  seed/
    index.json                 （変更なし）
```
**理由**: Issue #23の仕様に準拠。`common/` → `lib/` はNode.jsの慣例に合わせた変更。

### D6: エラーハンドリング
**決定**: `az` コマンドの失敗は `execFile` のexit codeで検出し、`throw` でスクリプトを停止する。`process.exit(1)` はトップレベルのcatchで使用する。
**理由**: PowerShellの `$ErrorActionPreference = 'Stop'` と同等の動作。

## Risks / Trade-offs

- **[互換性]** `az` CLIの出力パースが環境依存になる可能性 → `--output tsv` / `--output json` を明示的に指定して対処
- **[URL エンコード]** PowerShellの `[System.Uri]::EscapeDataString` と Node.jsの `encodeURIComponent` の動作差異 → SASトークンでは実質的に同等
- **[パス解決]** `$PSScriptRoot` の代替として `import.meta.url` + `fileURLToPath` を使用 → Node.js標準で安定
