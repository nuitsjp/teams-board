## Why

CSV取り込み時にグループ名の誤入力や表記ゆれが発生することがあり、CSVを再取り込みせずに後から修正できるようにする必要がある。データの一貫性と可読性を向上させるため。

## What Changes

- Admin画面またはグループ詳細画面にグループ名編集機能を追加
- グループ一覧または詳細画面に編集ボタンを配置
- インライン編集またはモーダルでグループ名を変更可能に
- グループIDは変更せず、`displayName`フィールドのみを更新
- 変更後、`index.json`を更新してBlob Storageに保存
- SAS token認証が必要（Admin権限のみ実行可能）

## Capabilities

### New Capabilities

- `group-name-edit`: UI上でグループの表示名を編集する機能。既存の`index.json`構造を維持しながら、グループの`displayName`フィールドを更新し、Blob Storageに保存する。

### Modified Capabilities

（既存のspecの要件変更なし）

## Impact

### 影響を受けるコード

- **UI層**:
  - `src/pages/AdminPage.jsx` または `src/pages/GroupDetailPage.jsx` - 編集UIの追加
  - `src/components/` - 新規コンポーネント（GroupNameEditor等）の追加
- **Services層**:
  - `src/services/BlobWriter.js` - 既存機能を使用（変更不要の可能性）
  - 新規サービス - IndexEditor または GroupNameUpdater（index.json更新ロジック）
- **Hooks**:
  - `src/hooks/useAuth.js` - 既存のSAS token認証を使用

### データ構造

- `data/index.json` の更新（構造変更なし、値の更新のみ）
- セッションデータ（`data/sessions/*.json`）には影響なし

### 依存関係

- 既存： Azure Blob Storage API、SAS token認証
- 新規依存なし
