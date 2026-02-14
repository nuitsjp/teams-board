### Requirement: IndexMerger のグループルックアップは Map ベースの O(1) で行う

`IndexMerger.merge()` は、グループ配列のシャローコピーと同時に `id → オブジェクト参照` の Map を構築し、グループの検索に `Map.get()` を使用しなければならない（SHALL）。配列の `find()` メソッドを使用してはならない。

#### Scenario: 既存グループへのセッション追加

- **WHEN** `merge()` に既存グループ ID を含むセッションが渡される
- **THEN** Map を使った O(1) ルックアップで該当グループを取得し、`totalDurationSeconds` と `sessionIds` を更新する

#### Scenario: 新規グループの追加

- **WHEN** `merge()` に未知のグループ ID を含むセッションが渡される
- **THEN** `Map.get()` が `undefined` を返し、新しいグループエントリを配列に追加する

### Requirement: IndexMerger のメンバールックアップは Map ベースの O(1) で行う

`IndexMerger.merge()` は、メンバー配列のシャローコピーと同時に `id → オブジェクト参照` の Map を構築し、メンバーの検索に `Map.get()` を使用しなければならない（SHALL）。配列の `find()` メソッドを使用してはならない。

#### Scenario: 既存メンバーの出席記録追加

- **WHEN** `merge()` に既存メンバー ID を含む出席データが渡される
- **THEN** Map を使った O(1) ルックアップで該当メンバーを取得し、`totalDurationSeconds` と `sessionIds` を更新する

#### Scenario: 新規メンバーの追加

- **WHEN** `merge()` に未知のメンバー ID を含む出席データが渡される
- **THEN** `Map.get()` が `undefined` を返し、新しいメンバーエントリを配列に追加する

### Requirement: IndexEditor のグループルックアップは Map ベースの O(1) で行う

`IndexEditor.updateGroupName()` は、グループ配列のシャローコピーと同時に `id → オブジェクト参照` の Map を構築し、グループの検索に `Map.get()` を使用しなければならない（SHALL）。配列の `find()` メソッドを使用してはならない。

#### Scenario: 既存グループ名の更新

- **WHEN** `updateGroupName()` に既存のグループ ID と新しい名前が渡される
- **THEN** Map を使った O(1) ルックアップで該当グループを取得し、名前を更新する

#### Scenario: 存在しないグループ ID の指定

- **WHEN** `updateGroupName()` に存在しないグループ ID が渡される
- **THEN** `Map.get()` が `undefined` を返し、エラーメッセージを返却する

### Requirement: 外部インターフェースの不変性

Map ベースへの内部実装変更後も、`IndexMerger.merge()` と `IndexEditor.updateGroupName()` の引数・戻り値の構造は変更してはならない（SHALL NOT）。

#### Scenario: merge の戻り値構造が維持される

- **WHEN** `merge()` が呼び出される
- **THEN** 戻り値は `{ index: { groups, members, updatedAt }, warnings }` の構造を維持する

#### Scenario: updateGroupName の戻り値構造が維持される

- **WHEN** `updateGroupName()` が呼び出される
- **THEN** 戻り値は `{ index: { groups, members, updatedAt }, error? }` の構造を維持する
