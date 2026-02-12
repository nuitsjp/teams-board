## Context

現在のインフラスクリプト群（`scripts/infra/` 配下の5ファイル）は、Azure環境固有パラメーターを `local.settings.json`（JSON形式）から読み込む共通ヘルパー `Load-LocalSettings.ps1` を使用している。一方、フロントエンド（Vite）は `.env` ファイルから `import.meta.env` 経由で環境変数を読み込んでいる。

環境設定が2系統に分散しているため、`.env` に一元化する。

### 現在のパラメータマッピング（全スクリプト共通）

| PowerShellパラメーター | JSON キー            | `.env` 変数名（新）          |
| -------------------- | -------------------- | ---------------------------- |
| `SubscriptionId`     | `subscriptionId`     | `AZURE_SUBSCRIPTION_ID`      |
| `ResourceGroupName`  | `resourceGroupName`  | `AZURE_RESOURCE_GROUP_NAME`  |
| `StorageAccountName` | `storageAccountName` | `AZURE_STORAGE_ACCOUNT_NAME` |
| `Location`           | `location`           | `AZURE_LOCATION`             |

## Goals / Non-Goals

**Goals:**

- `.env` ファイルにAzure環境変数を統合し、環境設定を一元管理する
- 既存スクリプトのコマンドライン引数による上書き動作を維持する
- `.env.example` を更新し、必要な変数を明示する

**Non-Goals:**

- フロントエンドコードの変更（すでに `.env` を使用済み）
- CI/CD パイプラインの変更（本リポジトリにCI/CDは未構成）
- `.env` の暗号化やシークレット管理の導入

## Decisions

### 1. `.env` パース方式: PowerShell自前パーサー

**選択**: PowerShellスクリプト内で `.env` ファイルを自前でパースする

**代替案**:

- サードパーティモジュール（`Set-PsEnv` 等）を使用 → 外部依存が増える
- Node.jsの`dotenv`をブリッジ → 過剰な複雑さ

**理由**: `.env` 形式は `KEY=VALUE` の行区切りで非常にシンプル。コメント行（`#`）と空行をスキップするだけで十分であり、外部依存を追加する必要がない。

### 2. ヘルパーファイルのリネーム: `Load-LocalSettings.ps1` → `Load-EnvSettings.ps1`

**選択**: ファイル名を変更して役割を明示する

**代替案**:

- ファイル名据え置きで中身のみ変更 → 名前と実態が乖離して混乱を招く

**理由**: ファイル名が機能を正確に表す方が保守性が高い。全スクリプトのドットソース行も一括で更新する。

### 3. 関数名の変更: `Load-LocalSettings` → `Load-EnvSettings` / `Apply-LocalSettings` → `Apply-EnvSettings`

**選択**: 関数名も `.env` ベースの名前に変更する

**理由**: ファイル名変更と一貫性を保つため。呼び出し元のスクリプトも同時に更新する。

### 4. `.env` 変数の命名規約: `AZURE_` プレフィックス

**選択**: Azure関連パラメーターには `AZURE_` プレフィックスを付与する（例： `AZURE_SUBSCRIPTION_ID`）

**代替案**:

- camelCaseのまま（JSON踏襲）→ `.env` の慣習に反する
- プレフィックスなし → 既存の `VITE_` 系変数との区別が不明瞭

**理由**: `.env` の一般的な慣習（UPPER*SNAKE_CASE、カテゴリプレフィックス）に従い、フロントエンド向け `VITE*` 変数と明確に区別できる。

### 5. パラメータマッピングの変更

**選択**: 各スクリプトの `ParameterMap` のJSON キー名を `.env` 変数名（UPPER_SNAKE_CASE）に変更する

```powershell
# Before
@{ "SubscriptionId" = "subscriptionId" }

# After
@{ "SubscriptionId" = "AZURE_SUBSCRIPTION_ID" }
```

**理由**: `.env` ファイルのキーとマッピングが直接対応し、中間変換が不要になる。

## Risks / Trade-offs

| リスク                                                                        | 緩和策                                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **BREAKING**: 既存の `local.settings.json` を使用している開発者の環境が壊れる | `.env.example` に必要な変数とコメントを記載し、移行手順を明確にする                                                 |
| `.env` パーサーの不備（クォート付き値、特殊文字等）                           | 現在のパラメーターはすべて単純な英数字文字列のため、基本的な `KEY=VALUE` パースで十分。クォートの除去処理は実装する   |
| `.gitignore` から `local.settings.json` を削除後、誤ってコミットされるリスク  | `.env` 統合後は `local.settings.json` 自体が不要になるため、`.gitignore` のエントリ削除ではなくコメント更新に留める |
