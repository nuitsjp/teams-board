## Why

管理機能でTeams出席レポートCSVをアップロードすると、現在は `raw/{timestamp}-{filename}.csv` というタイムスタンプベースのパスで元ファイルが保存されている。しかし、このパス命名ではどのセッションに対応するファイルなのかが分かりにくく、後から特定のセッションの元データを参照・再検証する際に不便である。ソースファイルをセッションIDと紐づけた形で保存することで、データの追跡可能性と管理性を向上させる。

## What Changes

- アップロードされたCSVファイルの保存パスを `raw/{timestamp}-{filename}.csv` から `data/sources/{sessionId}.csv` に変更し、セッションIDと紐づけて保存する
- これにより、各セッションの変換後JSON（`data/sessions/{sessionId}.json`）と元CSV（`data/sources/{sessionId}.csv`）が一対一で対応する構造になる
- 既存の `raw/` ディレクトリへの保存は廃止する

## Capabilities

### New Capabilities

- `original-source-storage`: アップロードされたCSVソースファイルをセッションIDと紐づけて `data/sources/` に保存する機能

### Modified Capabilities

（なし — openspec/specs/ に既存の仕様なし）

## Impact

- **blob-writer.js**: 書き込みシーケンスの `rawCsv` パス生成ロジックを変更
- **AdminPage.jsx**: `handleBulkSave` 内の `rawCsv.path` をセッションIDベースに変更
- **Azure Blob Storage**: `data/sources/` ディレクトリが新設される。既存の `raw/` ディレクトリは今後使用されなくなる
- **既存データ**: すでにアップロード済みの `raw/` 内ファイルには影響なし（移行不要）
