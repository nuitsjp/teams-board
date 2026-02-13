## Why

docs/index.md のドメインモデルテーブルには日本語の概念定義のみがあり、src/ 内のコード実装で使用される英語名（groupId, memberId, sessionId 等）との対応が明示されていない。開発者がドメインモデルの英語名を確実に把握できるよう、ドキュメントに英語用語列を追加して統一を図る。

## What Changes

- docs/index.md のドメインモデルテーブルに「英語用語」列を追加
- 以下の英語用語を定義：
  - 参加者レポート → Attendance Report
  - 参加記録 → Attendance Record
  - 会議グループ → Meeting Group (コード内: group, groupId)
  - メンバー → Member (コード内: member, memberId)
  - 会議 → Session (コード内: session, sessionId)
  - 参加 → Attendance (コード内: attendance)
- コード実装との整合性を確認し、不一致があれば修正

## Capabilities

### New Capabilities

なし（ドキュメント更新のみ）

### Modified Capabilities

なし（既存の機能要件に変更なし、ドキュメントの用語定義追加のみ）

## Impact

- **影響ファイル**: docs/index.md（ドメインモデルテーブルの更新）
- **コード変更**: なし（用語が既に統一されている場合）または軽微な命名修正
- **API変更**: なし
- **破壊的変更**: なし
