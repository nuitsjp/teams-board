### Requirement: グループ選択プルダウンの表示

FileQueueCard は、CSVパース成功後にグループ選択プルダウンを表示しなければならない（SHALL）。プルダウンには AdminPage から取得した既存グループ一覧が選択肢として含まれなければならない（MUST）。各選択肢にはグループ名を表示する。

#### Scenario: CSV パース成功後にプルダウンが表示される
- **WHEN** CSV ファイルがドロップされパースが成功する
- **THEN** FileQueueCard のサマリー行にグループ選択プルダウンが表示される

#### Scenario: 既存グループが選択肢に表示される
- **WHEN** プルダウンを開く
- **THEN** AdminPage で取得済みの既存グループ一覧がすべて選択肢として表示される

### Requirement: 自動検出グループのデフォルト選択

CSV の会議タイトルから自動検出されたグループ名と一致する既存グループがある場合、そのグループがプルダウンのデフォルト値として選択されなければならない（MUST）。一致する既存グループがない場合は、自動検出されたグループ名を「新規グループ」として表示しなければならない（MUST）。

#### Scenario: 自動検出グループが既存グループと一致する場合
- **WHEN** CSV のタイトルから生成された groupId が既存グループの id と一致する
- **THEN** プルダウンにはその既存グループがデフォルトで選択された状態になる

#### Scenario: 自動検出グループが既存グループと一致しない場合
- **WHEN** CSV のタイトルから生成された groupId がどの既存グループとも一致しない
- **THEN** プルダウンには自動検出されたグループ名が「新規グループ」として表示・選択された状態になる

### Requirement: グループ名が空の場合のエラー制御

CSV の会議タイトルが空（グループ名が空文字列）の場合、アイテムは `missing_group` ステータスとなり保存不可にしなければならない（MUST）。プルダウンで既存グループを選択することで保存可能にしなければならない（MUST）。

#### Scenario: グループ名が空のCSVがドロップされる
- **WHEN** 会議タイトルが空の CSV ファイルがパースされる
- **THEN** アイテムのステータスが `missing_group` になる
- **THEN** 「グループを選択してください」というメッセージが表示される
- **THEN** 一括保存ボタンの対象件数にこのアイテムは含まれない

#### Scenario: グループ名が空のアイテムでグループを選択する
- **WHEN** `missing_group` ステータスのアイテムでプルダウンから既存グループを選択する
- **THEN** アイテムのステータスが `ready` に遷移する
- **THEN** 一括保存ボタンの対象件数にこのアイテムが含まれるようになる

### Requirement: 選択グループによる mergeInput の上書き

プルダウンで既存グループを選択した場合、保存時に mergeInput の `groupId`・`groupName` と sessionRecord の `groupId` を選択されたグループの値で上書きしなければならない（MUST）。sessionId は `${選択グループのgroupId}-${日付}` で再生成しなければならない（MUST）。

#### Scenario: 既存グループを選択して保存する
- **WHEN** ユーザーがプルダウンで既存グループ（id: "abc12345", name: "勉強会A"）を選択する
- **WHEN** 一括保存が実行される
- **THEN** mergeInput の groupId が "abc12345" に上書きされる
- **THEN** mergeInput の groupName が "勉強会A" に上書きされる
- **THEN** sessionRecord の groupId が "abc12345" に上書きされる
- **THEN** sessionId が "abc12345-{日付}" に再生成される
- **THEN** sessionRecord の id も再生成された sessionId と一致する

#### Scenario: 新規グループ（自動検出）のまま保存する
- **WHEN** ユーザーがプルダウンを変更せず、自動検出グループのまま保存する
- **THEN** mergeInput と sessionRecord は CsvTransformer の出力値がそのまま使用される

### Requirement: グループ上書き後の重複チェック

グループを変更すると sessionId が変わるため、変更後の sessionId に対して重複チェックを実施しなければならない（MUST）。

#### Scenario: グループ変更後に sessionId が既存と重複する
- **WHEN** プルダウンでグループを変更した結果、新しい sessionId が既存の sessionId と重複する
- **THEN** アイテムのステータスが `duplicate_warning` に遷移する

#### Scenario: グループ変更後に sessionId が既存と重複しない
- **WHEN** プルダウンでグループを変更した結果、新しい sessionId が既存の sessionId と重複しない
- **THEN** アイテムのステータスが `ready` のままとなる

### Requirement: 保存中・保存済みアイテムのプルダウン無効化

`saving` または `saved` ステータスのアイテムではプルダウンを無効化（disabled）しなければならない（MUST）。

#### Scenario: 保存中のアイテムでプルダウンが操作不可になる
- **WHEN** アイテムのステータスが `saving` である
- **THEN** グループ選択プルダウンが disabled 状態になり操作できない

#### Scenario: 保存済みのアイテムでプルダウンが操作不可になる
- **WHEN** アイテムのステータスが `saved` である
- **THEN** グループ選択プルダウンが disabled 状態になり操作できない
