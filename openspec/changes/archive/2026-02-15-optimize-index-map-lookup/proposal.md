## Why

IndexMerger と IndexEditor は配列の `find()` メソッドで グループ・メンバーを検索しており、計算量が O(n) になっている。データ規模が大きくなると（グループ数・メンバー数の増加、1セッションあたりの出席者数の増加）パフォーマンスが劣化する。`Map` を使った O(1) ルックアップに置換することで、大規模データでもスケーラブルな処理を実現する。

## What Changes

- `IndexMerger.merge()` 内の `groups.find()` を `Map.get()` に置換し、グループ検索を O(1) 化
- `IndexMerger.merge()` 内の `members.find()` を `Map.get()` に置換し、メンバー検索を O(1) 化
- `IndexEditor.updateGroupName()` 内の `groups.find()` を `Map.get()` に置換し、グループ検索を O(1) 化
- 外部インターフェース（引数・戻り値の型・構造）は一切変更しない

## Capabilities

### New Capabilities

（なし — 新規機能の追加はない）

### Modified Capabilities

（なし — 外部から見た要件・振る舞いに変更はなく、内部実装の最適化のみ）

## Impact

- **対象コード**: `src/services/index-merger.js`, `src/services/index-editor.js`
- **テスト**: 既存のユニットテストがそのまま通ることで、ロジックの同一性を保証
- **API / 依存関係**: 変更なし（クラスの公開インターフェースは不変）
- **リスク**: 低 — 純粋なリファクタリングであり、既存テストによる回帰検証が可能
