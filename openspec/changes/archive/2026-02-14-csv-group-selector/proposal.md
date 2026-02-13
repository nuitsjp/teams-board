## Why

CSV登録時にグループ名がCSVの会議タイトルから自動抽出されるが、タイトルがない場合やCSVと異なるグループに登録したい場合に対応できない。ユーザーが既存グループをプルダウンから選択できるようにし、柔軟なグループ割り当てを実現する。

## What Changes

- FileQueueCard に既存グループを選択できるプルダウンUIを追加
- CSV解析後、自動検出されたグループ名をデフォルト選択状態にする
- グループ名が空（CSVにタイトルなし）の場合はエラー状態とし、プルダウンで既存グループを選択するまで保存不可にする
- プルダウンで既存グループを選択した場合、そのグループの `groupId` と `groupName` で `mergeInput` を上書きする
- sessionId も選択されたグループの groupId を基に再生成する（`groupId-YYYY-MM-DD` 形式）

## Capabilities

### New Capabilities

- `csv-group-selector`: CSV登録時にFileQueueCard内で既存グループをプルダウンから選択する機能。グループ名が空の場合のエラーハンドリング、選択されたグループ情報による mergeInput / sessionId の上書きを含む

### Modified Capabilities

（既存 spec の要件レベルの変更なし）

## Impact

- **コンポーネント**: `FileQueueCard` — プルダウンUI追加、props 拡張（既存グループ一覧の受け渡し）
- **フック**: `useFileQueue` — ユーザー選択グループの状態保持、mergeInput 上書きロジック追加
- **ページ**: `AdminPage` — 既存グループ一覧を FileQueueCard に渡すデータフロー追加
- **サービス**: `CsvTransformer` の出力構造は変更なし（mergeInput の上書きは useFileQueue 側で実施）
- **データ**: `index.json` / `sessions/*.json` のスキーマ変更なし
