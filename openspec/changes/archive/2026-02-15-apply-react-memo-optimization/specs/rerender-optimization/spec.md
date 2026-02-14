## ADDED Requirements

### Requirement: SummaryCard は React.memo で再レンダリングを抑制する

`SummaryCard` コンポーネントは `React.memo()` でラップされ、`title`、`value`、`icon`、`className` のいずれも変化していない場合に再レンダリングを SHALL スキップする。

#### Scenario: props 未変更時に再レンダリングをスキップする

- **WHEN** 親コンポーネントが再レンダリングされるが `SummaryCard` の props（`title`、`value`、`icon`、`className`）が前回と同一である
- **THEN** `SummaryCard` は再レンダリングされない

#### Scenario: props 変更時に再レンダリングする

- **WHEN** `value` prop が変更される（例: 総参加時間の更新）
- **THEN** `SummaryCard` は新しい値で再レンダリングされる

---

### Requirement: ProgressBar は React.memo で再レンダリングを抑制する

`ProgressBar` コンポーネントは `React.memo()` でラップされ、`current`、`total`、`visible`、`statusText` のいずれも変化していない場合に再レンダリングを SHALL スキップする。

#### Scenario: props 未変更時に再レンダリングをスキップする

- **WHEN** 親コンポーネントが再レンダリングされるが `ProgressBar` の props が前回と同一である
- **THEN** `ProgressBar` は再レンダリングされない

#### Scenario: 進捗更新時に再レンダリングする

- **WHEN** `current` prop が更新される（保存処理の進行）
- **THEN** `ProgressBar` は新しいパーセンテージで再レンダリングされる

---

### Requirement: FileQueueCard は React.memo で再レンダリングを抑制する

`FileQueueCard` コンポーネントは `React.memo()` でラップされ、props が変化していない場合に再レンダリングを SHALL スキップする。デフォルトの浅い比較を使用する（カスタム比較関数は不要）。

#### Scenario: 他のキューアイテムの変更時に再レンダリングをスキップする

- **WHEN** ファイルキュー内の別アイテムのステータスが変更されるが、当該 `FileQueueCard` の `item` 参照は変わらない
- **THEN** 当該 `FileQueueCard` は再レンダリングされない

#### Scenario: 自身のステータス変更時に再レンダリングする

- **WHEN** 当該アイテムのステータスが `pending` から `ready` に変更される
- **THEN** `FileQueueCard` は新しいステータスで再レンダリングされる

---

### Requirement: GroupList の各行は React.memo で再レンダリングを抑制する

`GroupList` 内の各グループ行は `GroupRow` コンポーネントとして抽出され、`React.memo()` が適用される。`GroupRow` は `group` オブジェクトと `onNavigate` コールバックを props として受け取る。

#### Scenario: グループデータ未変更時に行の再レンダリングをスキップする

- **WHEN** `GroupList` が再レンダリングされるが、特定のグループの `group` オブジェクト参照が変わらない
- **THEN** 該当する `GroupRow` は再レンダリングされない

#### Scenario: グループ行クリックでナビゲーションする

- **WHEN** ユーザーが `GroupRow` をクリックする
- **THEN** `onNavigate` が呼ばれ、グループ詳細ページ（`/groups/:groupId`）へ遷移する

---

### Requirement: MemberList の各行は React.memo で再レンダリングを抑制する

`MemberList` 内の各メンバー行は `MemberRow` コンポーネントとして抽出され、`React.memo()` が適用される。`MemberRow` は `member` オブジェクトと `onNavigate` コールバックを props として受け取る。

#### Scenario: 検索クエリ変更時に非該当行の再レンダリングをスキップする

- **WHEN** 検索クエリが変更されフィルタリング結果が更新されるが、表示対象のメンバーの `member` オブジェクト参照が変わらない
- **THEN** 該当する `MemberRow` は再レンダリングされない

#### Scenario: メンバー行クリックでナビゲーションする

- **WHEN** ユーザーが `MemberRow` をクリックする
- **THEN** `onNavigate` が呼ばれ、メンバー詳細ページ（`/members/:memberId`）へ遷移する

---

### Requirement: MemberList の検索入力は useTransition で優先度制御する

`MemberList` の検索入力は `useTransition` を使用し、入力値の表示を即座に行いつつ、フィルタリング用の `searchQuery` 更新を低優先度トランジションとして実行する。

#### Scenario: 検索入力中も入力欄が即座に応答する

- **WHEN** ユーザーが検索欄にテキストを入力する
- **THEN** 入力欄の表示は即座に更新され、フィルタリング結果の更新はトランジションとして非同期に処理される

#### Scenario: フィルタリング結果が正しく反映される

- **WHEN** ユーザーが検索クエリを入力し、トランジションが完了する
- **THEN** メンバーリストはクエリに一致するメンバーのみを表示する

---

### Requirement: useFileQueue の parsePendingItem 依存が安定化されている

`useFileQueue` の `parsePendingItem` コールバックは `state.existingSessionIds` を依存配列に含まず、`useRef` を介して最新値を参照する。これにより `parsePendingItem` の参照が安定し、`useEffect` の不要な再実行を SHALL 防止する。

#### Scenario: existingSessionIds 更新時に parsePendingItem が再生成されない

- **WHEN** `setExistingSessionIds` が呼ばれて `existingSessionIds` が更新される
- **THEN** `parsePendingItem` のコールバック参照は変化しない

#### Scenario: 重複チェックが最新の existingSessionIds を使用する

- **WHEN** `existingSessionIds` が更新された後に新しいファイルが追加される
- **THEN** `parsePendingItem` は最新の `existingSessionIds` を使用して重複チェックを行う
