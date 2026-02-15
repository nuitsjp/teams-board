## ADDED Requirements

### Requirement: ドメインモデルテーブルに英語用語列を含む

docs/index.md のドメインモデルテーブルは、各概念に対応する英語用語を明示しなければならない（SHALL）。

#### Scenario: 英語用語列の表示
- **WHEN** 開発者が docs/index.md のドメインモデルテーブルを参照する
- **THEN** 各ドメイン概念に対応する英語用語（Attendance Report, Meeting Group, Member, Session, Attendance 等）が表示される

#### Scenario: コード表現の併記
- **WHEN** ドメイン概念がコード内で識別子として使用される場合
- **THEN** 英語用語列にはコード表現（groupId, memberId, sessionId 等）も併記される
