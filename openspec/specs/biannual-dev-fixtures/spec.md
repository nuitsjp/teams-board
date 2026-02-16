## ADDED Requirements

### Requirement: 2025年度上期のセッションデータ追加

既存の dev-fixtures データ（2026年1〜2月 = 2025年度下期）に加え、2025年度上期（2025年4〜9月）のセッションデータを `dev-fixtures/data/sessions/` に追加しなければならない（MUST）。追加するセッションは既存の勉強会グループ（`b20ae593`, `75aa4f8f`, `078075da`, `b630e3f1`）に属し、既存のメンバー（`d2ede157`, `7c35db6e`, `70c5a8d7`, `85befc0e`, `c9f1e2a3`）が参加するデータとする。

#### Scenario: 上期のセッションファイルが追加される
- **WHEN** dev-fixtures を確認する
- **THEN** `dev-fixtures/data/sessions/` に 2025年4〜9月の日付を持つセッションJSONファイルが存在する
- **THEN** 各ファイルは既存のセッションJSONスキーマ（`id`, `groupId`, `date`, `attendances`）に準拠する

#### Scenario: 複数の勉強会グループに上期セッションがある
- **WHEN** 上期のセッションデータを確認する
- **THEN** 少なくとも2つの異なる勉強会グループに上期セッションが存在する
- **THEN** 期の切り替えデモで複数グループのアコーディオンが表示される

### Requirement: index.json の整合性更新

追加したセッションの ID を `dev-fixtures/data/index.json` の該当グループの `sessionIds` 配列とメンバーの `sessionIds` 配列に追加しなければならない（MUST）。グループおよびメンバーの `totalDurationSeconds` も追加セッションの参加時間を反映して更新しなければならない（MUST）。

#### Scenario: グループの sessionIds が更新される
- **WHEN** 勉強会グループ `b20ae593` に上期セッションが追加される
- **THEN** `index.json` の該当グループの `sessionIds` に新しいセッションIDが含まれる
- **THEN** グループの `totalDurationSeconds` が上期セッションの参加時間分だけ増加する

#### Scenario: メンバーの sessionIds が更新される
- **WHEN** メンバー `d2ede157` が上期セッションに参加している
- **THEN** `index.json` の該当メンバーの `sessionIds` に新しいセッションIDが含まれる
- **THEN** メンバーの `totalDurationSeconds` が上期セッションの参加時間分だけ増加する

### Requirement: 期の切り替えデモが可能なデータ量

追加するデータは、メンバー明細画面で期の切り替えをデモするのに十分な量でなければならない（MUST）。少なくとも1名のメンバーが上期・下期の両方に複数セッションの参加データを持つこと。

#### Scenario: 期を切り替えて上期のデータが表示される
- **WHEN** メンバー `d2ede157`（Suzuki Taro A）のメンバー明細画面を開く
- **WHEN** 「2025年度 上期」を選択する
- **THEN** 上期に属するセッションが勉強会別アコーディオンで表示される
- **THEN** 上期のサマリー（参加回数・合計時間）が正しく集計されている

#### Scenario: 下期に切り替えると既存データが表示される
- **WHEN** メンバー `d2ede157`（Suzuki Taro A）のメンバー明細画面で「2025年度 下期」を選択する
- **THEN** 既存の2026年1〜2月のセッションが表示される

### Requirement: 既存データの構造を変更しない

既存のセッションJSONファイルの内容を変更してはならない（SHALL NOT）。`index.json` のスキーマ（フィールド名・構造）も変更してはならない（SHALL NOT）。追加するのはセッションファイルの新規作成と、`index.json` 内の既存配列・数値への追記・加算のみとする。

#### Scenario: 既存セッションファイルが変更されていない
- **WHEN** 変更前後の既存セッションJSONファイルを比較する
- **THEN** 既存17ファイルの内容が一切変更されていない

#### Scenario: index.json のスキーマが変わらない
- **WHEN** 変更後の `index.json` を確認する
- **THEN** グループ・メンバーのフィールド構造（`id`, `name`, `totalDurationSeconds`, `sessionIds`）が変更前と同じである
- **THEN** 新しいフィールドが追加されていない
