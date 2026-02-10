## ADDED Requirements

### Requirement: Node.js共通ライブラリの配置

共通ライブラリは `scripts/lib/` ディレクトリにES Modules（`.mjs`）として配置しなければならない（MUST）。

#### Scenario: libディレクトリの構成

- **WHEN** 移行が完了した時点で
- **THEN** `scripts/lib/` に `azure-storage.mjs`、`env-settings.mjs`、`logger.mjs` の3ファイルが存在する

### Requirement: ロガーモジュールの提供

`scripts/lib/logger.mjs` は以下の関数をnamed exportとして提供しなければならない（SHALL）: `writeStep`, `writeAction`, `writeDetail`, `writeInfo`, `writeSuccess`, `writeWarn`。

#### Scenario: writeStep でセクション見出しを出力

- **WHEN** `writeStep("タイトル")` を呼び出す
- **THEN** `\n=== タイトル ===` がシアン色で標準出力に表示される

#### Scenario: writeAction で処理状態を出力

- **WHEN** `writeAction("メッセージ")` を呼び出す
- **THEN** メッセージがシアン色で標準出力に表示される

#### Scenario: writeDetail でラベル:値ペアを出力

- **WHEN** `writeDetail("ラベル", "値")` を呼び出す
- **THEN** `  ラベル: 値` の形式で標準出力に表示される

#### Scenario: writeInfo でプレーンテキストを出力

- **WHEN** `writeInfo("メッセージ")` を呼び出す
- **THEN** メッセージが装飾なしで標準出力に表示される

#### Scenario: writeSuccess で成功メッセージを出力

- **WHEN** `writeSuccess("メッセージ")` を呼び出す
- **THEN** メッセージが緑色で標準出力に表示される

#### Scenario: writeWarn で警告メッセージを出力

- **WHEN** `writeWarn("メッセージ")` を呼び出す
- **THEN** メッセージが黄色で標準出力に表示される

### Requirement: .env設定読み込みモジュールの提供

`scripts/lib/env-settings.mjs` は `loadEnvSettings` 関数と `importEnvParams` 関数をnamed exportとして提供しなければならない（SHALL）。

#### Scenario: loadEnvSettings で.envファイルを読み込む

- **WHEN** `loadEnvSettings()` をパス未指定で呼び出す
- **THEN** プロジェクトルートの `.env` ファイルが読み込まれ、キーと値のオブジェクトが返される

#### Scenario: loadEnvSettings で任意パスの.envファイルを読み込む

- **WHEN** `loadEnvSettings("/path/to/.env")` のようにパスを指定して呼び出す
- **THEN** 指定されたパスの `.env` ファイルが読み込まれる

#### Scenario: .envファイルが存在しない場合

- **WHEN** 指定パス（またはデフォルト）に `.env` ファイルが存在しない
- **THEN** ファイルパスを含むエラーメッセージと共に例外がスローされる

#### Scenario: importEnvParams で環境変数をオブジェクトとして取得

- **WHEN** `importEnvParams()` を呼び出す
- **THEN** `.env` の全キーがプロパティとして設定されたオブジェクトが返される

#### Scenario: .env.example に基づく必須キー検証

- **WHEN** `.env.example` に定義されたキーが `.env` に存在しない
- **THEN** 不足しているキー名を含むエラーメッセージと共に例外がスローされる

#### Scenario: .env.example が存在しない場合の検証スキップ

- **WHEN** プロジェクトルートに `.env.example` が存在しない
- **THEN** 必須キー検証はスキップされ、`.env` の全キーがオブジェクトとして返される

### Requirement: Azure Storage接続モジュールの提供

`scripts/lib/azure-storage.mjs` は `connectAzureStorage` 関数をnamed exportとして提供しなければならない（SHALL）。この関数は `az` CLIを `child_process.execFile` で呼び出す。

#### Scenario: Azure Storageへの正常接続

- **WHEN** 有効な `subscriptionId`, `resourceGroupName`, `storageAccountName` を指定して `connectAzureStorage` を呼び出す
- **THEN** サブスクリプションが切り替わり、Storageアカウントの存在が確認され、アカウントキーが返される

#### Scenario: サブスクリプション切替の失敗

- **WHEN** 無効な `subscriptionId` を指定して呼び出す
- **THEN** エラーメッセージ付きの例外がスローされる

#### Scenario: Storageアカウントが見つからない場合

- **WHEN** 存在しない `storageAccountName` を指定して呼び出す
- **THEN** エラーメッセージ付きの例外がスローされる

### Requirement: az CLIヘルパー関数の提供

`scripts/lib/azure-storage.mjs` は `az` コマンドを実行するヘルパー関数を内部に持たなければならない（MUST）。この関数は `child_process.execFile` をPromiseラップし、引数を配列で受け取る。

#### Scenario: azコマンドの正常実行

- **WHEN** 有効な `az` コマンドと引数を渡して実行する
- **THEN** コマンドの標準出力が文字列として返される

#### Scenario: azコマンドの失敗

- **WHEN** `az` コマンドが非ゼロ終了コードで終了する
- **THEN** 標準エラー出力を含むエラーメッセージと共に例外がスローされる
