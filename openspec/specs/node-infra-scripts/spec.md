## Purpose

Node.js ES Modules として実装された4つのメインスクリプトの仕様。Azure Blob Storage へのデプロイ、データクリア、SASトークン生成、URL表示機能を提供する。

## Requirements

### Requirement: deploy-static-files スクリプトの提供

`scripts/deploy-static-files.mjs` は、テスト・Lint・ビルドを実行した後、`dist/` 配下の成果物をAzure Blob Storage `$web` コンテナにアップロードしなければならない（SHALL）。

#### Scenario: テスト・Lint・ビルドの実行

- **WHEN** スクリプトを実行する
- **THEN** `pnpm test` → `pnpm lint` → `pnpm build` の順で実行され、いずれかが失敗した場合はエラーで中断する

#### Scenario: VITE_BLOB_BASE_URL環境変数の設定

- **WHEN** ビルドを実行する
- **THEN** `VITE_BLOB_BASE_URL` 環境変数が `https://<StorageAccountName>.blob.core.windows.net/$web` に設定された状態でビルドが実行される

#### Scenario: dist/配下のアップロード

- **WHEN** ビルドが成功した場合
- **THEN** `dist/` 配下のファイルが `$web` コンテナに `az storage blob upload-batch` で一括アップロードされる（`data/` ディレクトリは除外）

#### Scenario: 初期データの配置

- **WHEN** `$web` コンテナに `data/index.json` が存在しない場合
- **THEN** `scripts/seed/index.json` が `data/index.json` として `content-type: application/json; charset=utf-8` でアップロードされる

#### Scenario: 既存データの保持

- **WHEN** `$web` コンテナに `data/index.json` が既に存在する場合
- **THEN** アップロードはスキップされ、その旨がログ出力される

### Requirement: clear-data スクリプトの提供

`scripts/clear-data.mjs` は、`$web` コンテナの `data/` 配下のセッションデータを削除し、`data/index.json` をシードファイルで初期化しなければならない（SHALL）。

#### Scenario: data/配下のBlob削除

- **WHEN** スクリプトを実行する
- **THEN** `data/` 配下のBlobが一覧取得され、`data/index.json` 以外の全Blobが削除される

#### Scenario: data/配下にBlobが存在しない場合

- **WHEN** `data/` 配下にBlobが存在しない
- **THEN** 警告メッセージが表示され、削除処理はスキップされる

#### Scenario: index.jsonの初期化

- **WHEN** Blob削除処理が完了した後
- **THEN** `scripts/seed/index.json` で `data/index.json` が上書きされる

#### Scenario: シードファイルが見つからない場合

- **WHEN** `scripts/seed/index.json` が存在しない
- **THEN** エラーメッセージと共にスクリプトが終了する

### Requirement: new-sas-token スクリプトの提供

`scripts/new-sas-token.mjs` は、Stored Access PolicyからContainer SASトークンを生成し、管理者用URLを出力しなければならない（SHALL）。

#### Scenario: SASトークンの生成

- **WHEN** スクリプトを実行する
- **THEN** `--policy-name` で指定されたPolicy（デフォルト: `dashboard-admin`）からSASトークンが生成される

#### Scenario: 管理者用URLの出力

- **WHEN** SASトークンが生成された場合
- **THEN** SASトークンが `encodeURIComponent` でURLエンコードされ、`<webEndpoint>/index.html?token=<encodedSas>` 形式の管理者用URLが出力される

#### Scenario: --policy-name オプションの指定

- **WHEN** `--policy-name custom-policy` を指定して実行する
- **THEN** 指定されたPolicy名でSASトークンが生成される

### Requirement: show-urls スクリプトの提供

`scripts/show-urls.mjs` は、利用者用URLと管理者用URL（SASトークン付き）を表示しなければならない（SHALL）。

#### Scenario: URL表示

- **WHEN** スクリプトを実行する
- **THEN** 利用者用URL（`<webEndpoint>/index.html`）と管理者用URL（`<webEndpoint>/index.html?token=<encodedSas>`）が表示される

### Requirement: package.json の infra:\* スクリプト更新

`package.json` の `scripts` セクションで、`infra:*` スクリプトを `node` コマンドに変更しなければならない（MUST）。

#### Scenario: infra:publish の変更

- **WHEN** `pnpm infra:publish` を実行する
- **THEN** `node scripts/deploy-static-files.mjs` が実行される

#### Scenario: infra:sas の変更

- **WHEN** `pnpm infra:sas` を実行する
- **THEN** `node scripts/new-sas-token.mjs` が実行される

#### Scenario: infra:clear の変更

- **WHEN** `pnpm infra:clear` を実行する
- **THEN** `node scripts/clear-data.mjs` が実行される

#### Scenario: infra:urls の変更

- **WHEN** `pnpm infra:urls` を実行する
- **THEN** `node scripts/show-urls.mjs` が実行される

### Requirement: 旧PowerShellスクリプトの削除

移行完了後、旧PowerShellスクリプト（`.ps1`）と `scripts/common/` ディレクトリを削除しなければならない（MUST）。

#### Scenario: PowerShellファイルの削除

- **WHEN** 移行が完了した時点で
- **THEN** `scripts/` 配下に `.ps1` ファイルが存在しない

#### Scenario: commonディレクトリの削除

- **WHEN** 移行が完了した時点で
- **THEN** `scripts/common/` ディレクトリが存在しない
