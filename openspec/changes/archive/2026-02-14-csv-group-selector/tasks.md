## 1. useFileQueue の拡張

- [x] 1.1 fileQueueReducer に `SELECT_GROUP` アクションを追加し、キューアイテムに `groupOverride: { groupId, groupName }` フィールドを設定する
- [x] 1.2 fileQueueReducer に `MISSING_GROUP` アクションを追加し、groupName が空のパース結果に対して `missing_group` ステータスを設定する
- [x] 1.3 `parsePendingItem` 内で、パース成功かつ groupName が空の場合に `MISSING_GROUP` をディスパッチするロジックを追加する
- [x] 1.4 `selectGroup` コールバック関数を追加し、`SELECT_GROUP` アクションをディスパッチする。`missing_group` ステータスの場合は `ready` に遷移させる
- [x] 1.5 `SELECT_GROUP` 時に、変更後の sessionId（`${groupId}-${date}`）で `existingSessionIds` との重複チェックを行い、重複時は `duplicate_warning` ステータスに遷移させる
- [x] 1.6 `readyItems` の useMemo フィルタに `missing_group` ステータスが含まれないことを確認する

## 2. コンポーネントの更新

- [x] 2.1 FileQueueCard に `groups` prop と `onSelectGroup` prop を追加する
- [x] 2.2 FileQueueCard のサマリー行で、グループ名テキスト表示をプルダウン（`<select>`）に置き換える
- [x] 2.3 プルダウンの選択肢に既存グループ一覧を表示し、`groupOverride` または自動検出グループをデフォルト選択にする
- [x] 2.4 自動検出グループが既存グループと一致しない場合、「（新規）{グループ名}」の選択肢を先頭に追加する
- [x] 2.5 `missing_group` ステータスの場合、「グループを選択してください」のプレースホルダーとエラーメッセージを表示する
- [x] 2.6 `saving` / `saved` ステータスの場合、プルダウンを disabled にする
- [x] 2.7 FileQueueCardList に `groups` prop と `onSelectGroup` prop を追加し、各 FileQueueCard にバケツリレーする

## 3. AdminPage の更新

- [x] 3.1 FileQueueCardList に `groups` state と `selectGroup` コールバックを渡す
- [x] 3.2 `handleBulkSave` 内で、`groupOverride` が存在するアイテムに対して mergeInput の `groupId`・`groupName`・`sessionId` と sessionRecord の `groupId`・`id` を上書きするロジックを追加する

## 4. テスト

- [x] 4.1 useFileQueue のユニットテスト: `SELECT_GROUP` アクションによる `groupOverride` 設定を検証する
- [x] 4.2 useFileQueue のユニットテスト: groupName 空の場合の `missing_group` ステータス遷移を検証する
- [x] 4.3 useFileQueue のユニットテスト: グループ選択後の重複チェック（sessionId 再計算）を検証する
- [x] 4.4 FileQueueCard のユニットテスト: プルダウン表示、デフォルト選択、既存グループ一覧の表示を検証する
- [x] 4.5 FileQueueCard のユニットテスト: `missing_group` ステータス時のエラー表示とグループ選択後の遷移を検証する
- [x] 4.6 AdminPage のユニットテスト: `handleBulkSave` での mergeInput 上書きロジックを検証する
- [x] 4.7 既存テストが破壊されていないことを `pnpm test` で確認する
