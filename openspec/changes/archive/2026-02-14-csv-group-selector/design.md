## Context

現在の CSV 登録フローでは、CsvTransformer が会議タイトルから groupId（SHA-256 先頭 8 桁）と groupName を自動生成し、それが mergeInput / sessionRecord にそのまま使用される。ユーザーがグループを選択する手段はなく、タイトルが空の場合は空文字列のハッシュで意図しないグループが作成される。

関連するコンポーネント構成:
- `AdminPage` → `FileQueueCardList` → `FileQueueCard`
- `useFileQueue` フックが CsvTransformer を呼び出してパース結果を管理
- パース結果の `mergeInput` / `sessionRecord` が `handleBulkSave` でそのまま保存に使用される

## Goals / Non-Goals

**Goals:**
- FileQueueCard 内にグループ選択プルダウンを追加し、既存グループから選択可能にする
- グループ名が空の CSV でもエラーにせず、プルダウンで既存グループを選択すれば保存可能にする
- 選択されたグループの groupId / groupName で mergeInput と sessionRecord を上書きする

**Non-Goals:**
- 新規グループ名の自由入力（プルダウンからの既存グループ選択のみ）
- CsvTransformer 自体の変更（パース結果の構造はそのまま維持）
- sessionRecord / mergeInput のスキーマ変更

## Decisions

### 1. グループ上書き状態の管理場所: useFileQueue の reducer 内

**選択**: useFileQueue の reducer に `SELECT_GROUP` アクションを追加し、キューアイテムに `groupOverride` フィールドを持たせる。

**理由**: パース結果（`parseResult`）は CsvTransformer の出力として不変に保ち、ユーザー選択は別フィールドで管理する方がデバッグしやすく、元のパース結果を参照可能に保てる。

**代替案**:
- parseResult を直接書き換える → パース結果の不変性が崩れ、リセット操作が困難になるため不採用

### 2. mergeInput / sessionRecord の上書きタイミング: 保存時

**選択**: `handleBulkSave` 内で `groupOverride` がある場合に mergeInput と sessionRecord を上書きしてから保存する。

**理由**: パース結果を不変に保ちつつ、保存直前に最終的なデータを構築する。FileQueueCard のサマリー表示には `groupOverride` がある場合はそちらの groupName を表示する。

**代替案**:
- useFileQueue 内のパース直後に上書き → グループ変更のたびにパース結果の再構築が必要になり複雑化するため不採用

### 3. sessionId の再生成方法: groupId + 日付の連結

**選択**: 保存時に `${newGroupId}-${date}` で sessionId を再生成する。CsvTransformer の `#generateId` は private メソッドなので、同じロジック（SHA-256 先頭 8 桁）を別のユーティリティとして切り出す必要はない。既存グループの groupId をそのまま使うため、ハッシュ再計算は不要。

**理由**: 既存グループを選択した場合、そのグループの id（既にハッシュ生成済み）をそのまま使用するので、ハッシュ再計算は不要。

### 4. グループ名が空の場合の扱い: `missing_group` ステータス

**選択**: CsvTransformer のパース自体は成功（ok: true）のまま、useFileQueue 側で groupName が空の場合に `missing_group` ステータスを設定する。このステータスのアイテムは `readyItems` に含まれず、保存ボタンの対象外となる。プルダウンで既存グループを選択すると `ready` ステータスに遷移する。

**理由**: CsvTransformer はあくまで CSV パーサーとしての責務に留め、グループ選択のバリデーションは UI 層で行う。

**代替案**:
- CsvTransformer でタイトル空をエラー（ok: false）にする → パース自体は正常に完了しており参加者データも取得できているため、error にすると情報が失われる。不採用

### 5. プルダウンの配置と表示タイミング

**選択**: FileQueueCard のパース結果サマリー行に配置。グループ名のテキスト表示をプルダウンに置き換える。パース成功後（hasParseResult が true）に常に表示する。

**理由**: ユーザーが CSV をドロップした直後にグループを確認・変更できる自然な位置。

### 6. グループ一覧の伝達経路

**選択**: `AdminPage` → `FileQueueCardList` → `FileQueueCard` に `groups` prop をバケツリレーする。

**理由**: 現在のコンポーネント階層は浅く（3 段）、Context や状態管理ライブラリの導入は過剰。props の追加で十分対応可能。

## Risks / Trade-offs

- **重複 sessionId のリスク**: グループを変更すると sessionId が変わるため、変更後の sessionId が既存と重複する可能性がある → `existingSessionIds` による重複チェックを `groupOverride` 適用後にも再実行して対処する
- **保存中のグループ変更**: saving ステータスのアイテムはプルダウンを disabled にして変更を防止する
- **グループ一覧の鮮度**: ページ読み込み時に取得したグループ一覧を使用するため、他ユーザーが同時にグループを追加した場合は反映されない → 既存の楽観的ロック機構（updatedAt 比較）で保護されているため、保存時に競合が検出される
