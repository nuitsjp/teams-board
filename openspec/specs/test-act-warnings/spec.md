### Requirement: useFileQueue テストが act 警告なしで実行される
`useFileQueue.test.jsx` のすべてのテストケースは、React の `act(...)` 警告を stderr に出力せずに実行を完了しなければならない（SHALL）。非同期ステート更新の待機には `@testing-library/react` の `waitFor` を使用しなければならない（SHALL）。

#### Scenario: SELECT_GROUP テストケースが警告なしで通過する
- **WHEN** `selectGroup で groupOverride が設定される` テストを実行する
- **THEN** テストがパスし、stderr に `act(...)` 警告が出力されない

#### Scenario: SELECT_GROUP 重複テストケースが警告なしで通過する
- **WHEN** `selectGroup で変更後の sessionId が既存と重複する場合 duplicate_warning になる` テストを実行する
- **THEN** テストがパスし、stderr に `act(...)` 警告が出力されない

#### Scenario: MISSING_GROUP テストケースが警告なしで通過する
- **WHEN** `groupName が空の場合 missing_group ステータスになる` テストを実行する
- **THEN** テストがパスし、stderr に `act(...)` 警告が出力されない

#### Scenario: MISSING_GROUP からグループ選択テストケースが警告なしで通過する
- **WHEN** `missing_group のアイテムでグループを選択すると ready になる` テストを実行する
- **THEN** テストがパスし、stderr に `act(...)` 警告が出力されない

### Requirement: waitFor の使用パターンがプロジェクト規約に準拠する
`useFileQueue.test.jsx` の非同期待機は `vi.waitFor` ではなく `@testing-library/react` の `waitFor` を使用しなければならない（SHALL）。これはプロジェクト内の他テストファイルと一貫したパターンである。

#### Scenario: vi.waitFor が使用されていない
- **WHEN** `useFileQueue.test.jsx` のソースコードを検査する
- **THEN** `vi.waitFor` の呼び出しが存在しない

#### Scenario: RTL waitFor が使用されている
- **WHEN** `useFileQueue.test.jsx` のソースコードを検査する
- **THEN** `@testing-library/react` から `waitFor` がインポートされ、非同期待機に使用されている
