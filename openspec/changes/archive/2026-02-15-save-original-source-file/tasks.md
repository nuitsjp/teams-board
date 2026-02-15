## 1. ソースファイル保存パスの変更

- [x] 1.1 `AdminPage.jsx` の `handleBulkSave` 内で `rawCsv.path` を `raw/${timestamp}-${item.file.name}` から `data/sources/${sessionRecord.id}.csv` に変更する
- [x] 1.2 `AdminPage.jsx` の `handleBulkSave` 内で不要になった `timestamp` 変数（`const timestamp = new Date().toISOString().replace(/[:.]/g, '-');`）を削除する

## 2. テスト

- [x] 2.1 `AdminPage.jsx` の変更に対する既存テストが通ることを確認する（`pnpm test`）
- [x] 2.2 `handleBulkSave` で `blobWriter.executeWriteSequence` に渡される `rawCsv.path` が `data/sources/{sessionId}.csv` 形式であることを検証するテストを追加する
