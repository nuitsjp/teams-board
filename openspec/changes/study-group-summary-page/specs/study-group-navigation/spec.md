## ADDED Requirements

### Requirement: StudyGroupListのリンク化

システムはトップページの勉強会一覧の各項目をクリック可能なリンクとして表示しなければならない（SHALL）。リンクは対応する勉強会詳細ページへ遷移する。

#### Scenario: 勉強会項目のクリックによる遷移

- **WHEN** ユーザーがトップページの勉強会一覧で勉強会をクリックする
- **THEN** `#/study-groups/:studyGroupId` へ遷移する

#### Scenario: リンクのホバー表示

- **WHEN** ユーザーが勉強会項目にマウスを乗せる
- **THEN** クリック可能であることが視覚的にわかるスタイル変化（ホバーエフェクト）が表示される

### Requirement: ルーティング定義の追加

システムは `#/study-groups/:studyGroupId` パスのルートを定義しなければならない（SHALL）。

#### Scenario: 勉強会詳細ページへの直接アクセス

- **WHEN** ユーザーが `#/study-groups/:studyGroupId` のURLに直接アクセスする
- **THEN** 対応する勉強会詳細ページが表示される

#### Scenario: 存在しないルートへのアクセス

- **WHEN** ユーザーが未定義のパスにアクセスする
- **THEN** 既存のフォールバック動作（トップページへリダイレクト）が維持される
