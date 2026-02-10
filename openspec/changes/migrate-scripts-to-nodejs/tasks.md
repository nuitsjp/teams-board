## 1. 共通ライブラリの作成

- [x] 1.1 `scripts/lib/logger.mjs` を作成する（writeStep, writeAction, writeDetail, writeInfo, writeSuccess, writeWarn をANSIエスケープコードで実装）
- [x] 1.2 `scripts/lib/env-settings.mjs` を作成する（loadEnvSettings, importEnvParams を実装。.envパース、クォート除去、.env.example検証を含む）
- [x] 1.3 `scripts/lib/azure-storage.mjs` を作成する（execAz ヘルパー関数、connectAzureStorage を実装）

## 2. メインスクリプトの作成

- [x] 2.1 `scripts/deploy-static-files.mjs` を作成する（テスト・Lint・ビルド実行、dist/アップロード、初期データ配置）
- [x] 2.2 `scripts/clear-data.mjs` を作成する（data/配下Blob削除、index.json初期化）
- [x] 2.3 `scripts/new-sas-token.mjs` を作成する（SASトークン生成、管理者用URL出力）
- [x] 2.4 `scripts/show-urls.mjs` を作成する（利用者用URL・管理者用URL表示）

## 3. package.json更新と旧ファイル削除

- [x] 3.1 `package.json` の `infra:*` スクリプトを `node scripts/*.mjs` に変更する
- [x] 3.2 旧PowerShellスクリプト（4つの.ps1ファイル）を削除する
- [x] 3.3 `scripts/common/` ディレクトリ（3つの.ps1ファイル）を削除する

## 4. 動作確認

- [x] 4.1 `pnpm lint` が通ることを確認する
- [x] 4.2 `pnpm test` が通ることを確認する
